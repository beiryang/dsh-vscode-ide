/**
 * Monaco 加载（ESM）。
 *
 * 之前的 AMD 方案在这台机器上失败过：页面里已经存在带 `.amd` 的 `define`，
 * Monaco 的 AMD loader 检测到后跳过初始化，`require()` 永远不回调（15s 超时）。
 * 现在改成由 esbuild 预先打好的 ESM 包，运行时用 `import(url)` 加载，
 * 完全不碰全局 define / require —— 也就不会再和其它插件抢命名空间。
 *
 * 产物见 scripts/build-monaco.mjs：
 *   vendor/monaco/esm/monaco.js      编辑器 + 语言（约 4 MB）
 *   vendor/monaco/esm/monaco.css     编辑器样式（单独 <link>）
 *   vendor/monaco/esm/workers/*.js   语言服务 worker
 */

const BASE = '/dsh-vscode-ide/assets/monaco/esm'

export const MONACO_JS_URL = `${BASE}/monaco.js`
export const MONACO_CSS_URL = `${BASE}/monaco.css`
const WORKER_DIR = `${BASE}/workers`

/** Monaco 用 label 找 worker；同一种 worker 服务多个语言（scss/less 共用 css.worker） */
const WORKER_BY_LABEL: Record<string, string> = {
  json: 'json.worker.js',
  css: 'css.worker.js',
  scss: 'css.worker.js',
  less: 'css.worker.js',
  html: 'html.worker.js',
  handlebars: 'html.worker.js',
  razor: 'html.worker.js',
  typescript: 'ts.worker.js',
  javascript: 'ts.worker.js'
}

type MonacoNamespace = any

let loading: Promise<MonacoNamespace> | null = null

export function monacoBaseUrl() {
  return BASE
}

/** 失败时用来判断“资源没发出去”还是“模块内部炸了” */
export function monacoDiag() {
  const g = window as unknown as { monaco?: any }
  return {
    monacoGlobal: typeof g.monaco,
    editor: Boolean(g.monaco && g.monaco.editor),
    environment: typeof (self as unknown as { MonacoEnvironment?: unknown }).MonacoEnvironment,
    js: MONACO_JS_URL,
    css: MONACO_CSS_URL
  }
}

/** 探测静态资源是否真的能从页面取到（区分“路由 404”和“加载器问题”） */
export async function reachable(
  url: string,
  timeoutMs = 8000
): Promise<{ ok: boolean; status: number; type?: string; bytes?: number; error?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
    const type = response.headers.get('content-type') || undefined
    const buffer = await response.arrayBuffer()
    return { ok: response.ok && buffer.byteLength > 0, status: response.status, type, bytes: buffer.byteLength }
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) }
  } finally {
    clearTimeout(timer)
  }
}

function ensureStylesheet() {
  if (document.querySelector('link[data-dsv-monaco-css]')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = MONACO_CSS_URL
  link.setAttribute('data-dsv-monaco-css', '')
  document.head.appendChild(link)
}

function installWorkerFactory() {
  const environment = {
    getWorker(_moduleId: string, label: string) {
      const file = WORKER_BY_LABEL[label] ?? 'editor.worker.js'
      return new Worker(`${WORKER_DIR}/${file}`, { name: `dsv-${label || 'editor'}` })
    }
  }
  ;(self as unknown as { MonacoEnvironment?: unknown }).MonacoEnvironment = environment
  ;(window as unknown as { MonacoEnvironment?: unknown }).MonacoEnvironment = environment
}

export function loadMonaco(): Promise<MonacoNamespace> {
  if (!loading) loading = boot()
  return loading
}

async function boot(): Promise<MonacoNamespace> {
  const g = window as unknown as { monaco?: MonacoNamespace }
  if (g.monaco && g.monaco.editor) return g.monaco

  try {
    ensureStylesheet()
    installWorkerFactory()

    const probe = await reachable(MONACO_JS_URL, 20000)
    if (!probe.ok) {
      throw new Error(`monaco.js 不可达（status=${probe.status} ${probe.error ?? ''}）`)
    }

    // 变量形式的动态 import：esbuild 保留运行时加载，不打进客户端 bundle
    const url = MONACO_JS_URL
    const module = await import(/* @vite-ignore */ url)
    const monaco: MonacoNamespace = (module as unknown as { monaco?: MonacoNamespace }).monaco ?? module
    if (!monaco || !monaco.editor) throw new Error('monaco.js 已加载但没有导出 editor')

    g.monaco = monaco
    return monaco
  } catch (error) {
    loading = null // 允许重试
    throw error
  }
}
