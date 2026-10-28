/**
 * 环境探针：`await __dsv.probe()`。
 *
 * Phase 0 的核心目的就是把「不可预知的运行时事实」一次问清：
 *   - 页面真实 origin（http://127.0.0.1:<port> 还是 Electron 的 dsh-app://）
 *   - 相对路径 fetch 能否到达插件宿主
 *   - 同源 / blob worker 是否被 CSP 或协议限制挡住（决定 Monaco 语言服务怎么接）
 *   - 壳与 DSH 模态的层级关系（决定 z-index）
 *   - 插槽容器的真实尺寸（决定入口面板能做多大）
 *
 * 任何一项失败都不应让插件崩溃，所以每一步都是独立 try/catch。
 */

import { BASE, call, health } from './transport'
import { registry } from './registry'

export type ProbeResult = Record<string, unknown>

const TIMEOUT = 4000

function now() {
  return Math.round(performance.now())
}

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

async function timed<T>(label: string, run: () => Promise<T>): Promise<{ label: string; ok: boolean; ms: number; value?: T; error?: string }> {
  const started = now()
  try {
    const value = await run()
    return { label, ok: true, ms: now() - started, value }
  } catch (error) {
    return { label, ok: false, ms: now() - started, error: errorText(error) }
  }
}

function testWorker(url: string, label: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const started = now()
    let settled = false
    let worker: Worker | undefined

    const finish = (payload: Record<string, unknown>) => {
      if (settled) return
      settled = true
      try {
        worker?.terminate()
      } catch {
        /* 忽略 */
      }
      resolve({ label, ms: now() - started, ...payload })
    }

    const timer = window.setTimeout(() => finish({ ok: false, error: 'timeout' }), TIMEOUT)

    try {
      worker = new Worker(url)
      worker.onmessage = (event) => {
        window.clearTimeout(timer)
        finish({ ok: true, echo: event.data })
      }
      worker.onerror = (event) => {
        window.clearTimeout(timer)
        const message = (event as ErrorEvent)?.message || 'worker error'
        finish({ ok: false, error: message })
      }
      worker.postMessage({ from: 'dsh-vscode-ide', label })
    } catch (error) {
      window.clearTimeout(timer)
      finish({ ok: false, error: errorText(error) })
    }
  })
}

function readVars(names: string[]) {
  const style = getComputedStyle(document.body)
  const out: Record<string, string> = {}
  for (const name of names) out[name] = style.getPropertyValue(name).trim()
  return out
}

function bodyLayers() {
  const rows: Array<Record<string, unknown>> = []
  for (const element of Array.from(document.body.children).slice(0, 40)) {
    const style = getComputedStyle(element)
    rows.push({
      tag: element.tagName.toLowerCase(),
      marker: element.getAttribute('data-dsv-host') !== null ? 'dsv-host' : element.id || String(element.className || '').slice(0, 48),
      position: style.position,
      zIndex: style.zIndex,
      pointerEvents: style.pointerEvents
    })
  }
  return rows
    .sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0))
    .slice(0, 10)
}

function slotBox() {
  const element = document.querySelector('[data-dsv-slot]')
  if (!element) return null
  const rect = element.getBoundingClientRect()
  return {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    top: Math.round(rect.top),
    left: Math.round(rect.left)
  }
}

export async function runProbe(): Promise<ProbeResult> {
  const result: ProbeResult = {
    at: new Date().toISOString(),
    location: {
      origin: location.origin,
      protocol: location.protocol,
      href: location.href.slice(0, 300),
      baseURI: document.baseURI
    },
    document: {
      title: document.title,
      readyState: document.readyState,
      bodyChildren: document.body ? document.body.children.length : 0
    },
    csp: Array.from(document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')).map((meta) =>
      (meta.getAttribute('content') || '').slice(0, 400)
    ),
    theme: {
      dark: document.body?.hasAttribute('data-ds-dark-theme') === true,
      vars: readVars(['--dsw-alias-bg-base', '--dsw-alias-label-primary', '--dsh-font-family-code'])
    },
    storage: await timed('localStorage', async () => {
      const key = 'dsv:probe'
      localStorage.setItem(key, '1')
      const value = localStorage.getItem(key)
      localStorage.removeItem(key)
      return value === '1'
    }),
    host: await timed('host.health', async () => health()),
    api: await timed('host.api.info', async () => call('info', {})),
    /** 各 feature 自己的诊断（比如 Monaco 资源能否加载）由它们注册 */
    features: await (async () => {
      const out: Record<string, unknown> = {}
      for (const probe of registry.getProbes()) {
        out[probe.id] = await timed(`feature.${probe.id}`, async () => probe.run())
      }
      return out
    })(),
    workers: {
      sameOrigin: await testWorker(`${BASE}/assets/probe-worker.js`, 'same-origin'),
      blob: await (async () => {
        const source = "self.onmessage = (e) => self.postMessage({ blob: true, echo: e.data })"
        const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
        try {
          return await testWorker(url, 'blob')
        } finally {
          URL.revokeObjectURL(url)
        }
      })()
    },
    layout: {
      slot: slotBox(),
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      bodyLayers: bodyLayers()
    }
  }

  const summary = {
    origin: String(result.location && (result.location as Record<string, unknown>).origin),
    同源worker: (result.workers as Record<string, Record<string, unknown>>).sameOrigin,
    blobworker: (result.workers as Record<string, Record<string, unknown>>).blob,
    宿主: result.host,
    接口: result.api,
    插槽: (result.layout as Record<string, unknown>).slot
  }
  // eslint-disable-next-line no-console
  console.log('[dsh-vscode-ide] probe', summary)
  return result
}
