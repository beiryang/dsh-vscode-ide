/**
 * 远程（内置 dsh-remote-ssh 或外部插件）HTTP API 的小封装。
 *
 * 端点是 /remote-ssh/api/<method>，POST JSON，必须带 x-requested-with（宿主做 CSRF 校验）。
 * 未启用内置远程、且外部插件也没安装时，这里会返回 { ok:false, error }，由 UI 显示说明。
 */

export type RemoteApiFailure = { ok: false; error: string }
export type RemoteApiSuccess<T> = { ok: true; value: T }
export type RemoteApiResult<T> = RemoteApiSuccess<T> | RemoteApiFailure

export async function remoteApi<T>(
  method: string,
  args?: Record<string, unknown>,
  timeoutMs = 60000
): Promise<RemoteApiResult<T>> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`/remote-ssh/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
      body: JSON.stringify(args ?? {}),
      signal: controller.signal
    })
    const text = await response.text()
    if (!text.trim()) {
      return {
        ok: false,
        error: `HTTP ${response.status}（服务未就绪：内置远程没启用，或 dsh-remote-ssh 被停用）`
      }
    }
    try {
      const payload = JSON.parse(text) as { ok?: boolean; value?: T; error?: { message?: string } }
      if (payload && payload.ok) return { ok: true, value: payload.value as T }
      return { ok: false, error: payload?.error?.message || `HTTP ${response.status}` }
    } catch {
      return { ok: false, error: `HTTP ${response.status}：响应不是 JSON（${text.slice(0, 80)}）` }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, error: `请求超时（${Math.round(timeoutMs / 1000)} 秒）` }
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  } finally {
    window.clearTimeout(timer)
  }
}

/** 远程脚本可能对路径很敏感：统一用 /，去掉末尾多余斜杠 */
export function remoteJoin(base: string, name: string): string {
  if (!base || base === '~') return base === '~' ? `~/${name}` : name
  return `${base.replace(/\/+$/, '')}/${name}`
}

export function remoteBaseName(path: string): string {
  const clean = path.replace(/\/+$/, '')
  const name = clean.split('/').filter(Boolean).pop()
  return name || path
}
