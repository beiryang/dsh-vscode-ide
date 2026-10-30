/**
 * 宿主 API 客户端。
 *
 * 所有请求都走相对路径 `/dsh-vscode-ide/api/*`：DSH 页面无论是
 * `http://127.0.0.1:<port>` 还是 Electron 的 `dsh-app://` 自定义协议，
 * 相对路径都会被它自己的协议处理器转给本地服务（探针会验证这一点）。
 */

export const BASE = '/dsh-vscode-ide'

export type Entry = {
  name: string
  path: string
  dir: boolean
  link?: boolean
  size: number
  mtimeMs: number
}

export type Listing = { path: string; entries: Entry[] }

export type ReadResult = {
  path: string
  size: number
  mtimeMs: number
  binary: boolean
  truncated: boolean
  bom?: boolean
  text: string
  lines: number
  eol: 'lf' | 'crlf'
}

let sessionId = ''

export function setSessionId(id: string | undefined) {
  sessionId = id || ''
}

export function getSessionId() {
  return sessionId
}

type ApiError = Error & { code?: string }

export async function call<T>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${BASE}/api/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, ...body })
  })

  let payload: { ok?: boolean; value?: unknown; error?: { code?: string; message?: string } } | null = null
  try {
    payload = await response.json()
  } catch {
    /* 非 JSON 响应（例如 404 页面），下面统一报错 */
  }

  if (!response.ok || !payload || payload.ok !== true) {
    const error = new Error(payload?.error?.message || `HTTP ${response.status}`) as ApiError
    error.code = payload?.error?.code
    throw error
  }
  return payload.value as T
}

/** GET 健康检查：不走 session，用来判断宿主半边是否挂上 */
export async function health(timeoutMs = 4000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${BASE}/health`, { signal: controller.signal })
    const payload = await response.json()
    return payload as { ok: boolean; value?: Record<string, unknown> }
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  info: () => call<{ name: string; version: string; cwd: string | null }>('info'),
  roots: () => call<{ cwd: string; remote?: boolean; remoteRoot?: string | null }>('roots'),
  list: (path: string) => call<Listing>('list', { path }),
  read: (path: string) => call<ReadResult>('read', { path }),
  createEntry: (path: string, dir: boolean) => call<{ path: string; dir: boolean }>('fs/create', { path, dir }),
  deleteEntry: (path: string) => call<{ path: string }>('fs/delete', { path }),
  renameEntry: (path: string, name: string) => call<{ path: string; name: string }>('fs/rename', { path, name }),
  moveEntry: (from: string, toDir: string) => call<{ path: string; moved: boolean }>('fs/move', { from, toDir }),
  revealEntry: (path: string) => call<{ path: string }>('fs/reveal', { path }),
  stat: (path: string) => call<{ path: string; dir: boolean; size: number; mtimeMs: number }>('stat', { path }),
  search: (options: { query?: string; limit?: number } = {}) =>
    call<{ files: Array<{ path: string; rel: string; name: string }>; truncated: boolean; root: string }>('search', options),
  /** 全文替换（先搜索定位文件，再逐文件原子写） */
  replaceContent: (options: { query: string; replacement: string; regex?: boolean; caseSensitive?: boolean; wholeWord?: boolean }) =>
    call<{ engine: 'git' | 'walk'; filesChanged: number; replaced: number; filesScanned: number; truncated: boolean }>(
      'replace/content',
      options
    ),
  /** 全局内容搜索（Git 仓库走 git grep，其余遍历） */
  searchContent: (options: { query: string; regex?: boolean; caseSensitive?: boolean; wholeWord?: boolean }) =>
    call<{
      engine: 'git' | 'walk'
      root: string
      truncated: boolean
      elapsedMs: number
      scanned?: number
      matches: Array<{ path: string; rel: string; line: number; text: string }>
    }>('search/content', options),
  write: (path: string, text: string, bom = false) => call<{ path: string; size: number; mtimeMs: number }>('write', { path, text, bom }),
  /** 在工作区里扫描 Git 仓库目录（相对路径，'' 表示工作区根） */
  gitCandidates: (gitDir = '') => call<{ repos: string[]; remote: boolean }>('git/candidates', { gitDir }),
  gitStatus: (gitDir = '') =>
    call<{
      root: string
      branch: string
      ahead: number
      behind: number
      changes: Array<{ path: string; absPath: string; code: string; staged: boolean; from?: string }>
    }>('git/status', { gitDir }),
  gitLog: (limit = 20, gitDir = '') =>
    call<{
      root: string
      commits: Array<{ hash: string; full: string; author: string; when: string; subject: string; parents: string[]; refs: string }>
    }>('git/log', { limit, gitDir }),
  gitHead: (path: string, gitDir = '') =>
    call<{ root: string; rel: string; text: string; exists: boolean }>('git/head', { path, gitDir }),
  gitStage: (paths: string[], gitDir = '') => call<{ staged: number }>('git/stage', { paths, gitDir }),
  gitUnstage: (paths: string[], gitDir = '') => call<{ unstaged: number }>('git/unstage', { paths, gitDir }),
  gitStageAll: (gitDir = '') => call<{ ok: boolean }>('git/stageAll', { gitDir }),
  gitUnstageAll: (gitDir = '') => call<{ ok: boolean }>('git/unstageAll', { gitDir }),
  gitDiscard: (paths: string[], untracked: string[] = [], gitDir = '') =>
    call<{ restored: number; removed: number }>('git/discard', { paths, untracked, gitDir }),
  gitCommit: (message: string, gitDir = '') => call<{ output: string }>('git/commit', { message, gitDir }),
  gitCommitInfo: (hash: string, gitDir = '') =>
    call<{ hash: string; author: string; when: string; subject: string; refs: string; files: Array<{ status: string; path: string }> }>(
      'git/commit-info',
      { hash, gitDir }
    ),
  gitCommitFile: (hash: string, path: string, gitDir = '') =>
    call<{ left: string; right: string; rel: string }>('git/commit-file', { hash, path, gitDir }),
  gitCheckout: (ref: string, gitDir = '') => call<{ output: string }>('git/checkout', { ref, gitDir }),
  gitCreateBranch: (name: string, ref: string, gitDir = '') =>
    call<{ output: string }>('git/branch', { name, ref, gitDir }),
  gitRevert: (ref: string, gitDir = '') => call<{ output: string }>('git/revert', { ref, gitDir }),
  gitPull: (gitDir = '') => call<{ output: string }>('git/pull', { gitDir }),
  gitFetch: (gitDir = '') => call<{ output: string }>('git/fetch', { gitDir }),
  gitPush: (gitDir = '') => call<{ output: string }>('git/push', { gitDir }),
  /** 新建 SSH 终端；ssh 省略时用当前远程工作区的元数据 */
  termOpen: (
    cols: number,
    rows: number,
    ssh?: { host: string; port?: number; user: string; keyPath?: string; password?: string; passphrase?: string }
  ) => call<{ id: string; label: string }>('term/open', { cols, rows, ssh }),
  /** 当前会话若是远程工作区，返回预填用的连接参数 */
  sshInfo: () =>
    call<{ host: string; port: number; user: string; keyPath?: string; remotePath?: string } | null>('ssh/info', {}),
  localOpen: () => call<{ id: string; label: string; shell: string }>('local/open', {}),
  termWrite: (id: string, data: string) => call<{ written: boolean }>('term/write', { id, data }),
  termResize: (id: string, cols: number, rows: number) => call<{ resized: boolean }>('term/resize', { id, cols, rows }),
  termClose: (id: string) => call<{ closed: boolean }>('term/close', { id }),
  /** 导入本地 VS Code 主题 JSON（宿主读文件） */
  importTheme: (path: string) =>
    call<{ name: string; path: string; type: 'dark' | 'light'; colors: Record<string, string>; rules: Array<{ token: string; foreground?: string; fontStyle?: string }> }>(
      'theme/import',
      { path }
    ),
  /** 导入本地 VS Code 图标主题（宿主读 JSON + SVG，返回合成好的 sprite） */
  importIcons: (path: string) =>
    call<{
      name: string
      path: string
      icons: number
      missing: number
      sprite: string
      mapping: {
        fileNames: Record<string, string>
        fileExtensions: Record<string, string>
        folderNames: Record<string, string>
        folderNamesExpanded: Record<string, string>
        defaults: { file: string; folder: string; folderExpanded: string }
      }
    }>('icons/import', { path }),
  /** 把探针结果落到宿主临时目录，返回文件路径（免去复制粘贴） */
  saveProbe: (result: unknown) => call<{ path: string }>('probe', { result })
}
