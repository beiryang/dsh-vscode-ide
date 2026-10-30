/**
 * 远程（内置 dsh-remote-ssh 或外部插件）HTTP API 的小封装。
 *
 * 端点是 /remote-ssh/api/<method>，POST JSON，必须带 x-requested-with（宿主做 CSRF 校验）。
 * 未启用内置远程、且外部插件也没安装时，这里会返回 { ok:false, error }，由 UI 显示说明。
 */

export type RemoteApiFailure = { ok: false; error: string }
export type RemoteApiSuccess<T> = { ok: true; value: T }
export type RemoteApiResult<T> = RemoteApiSuccess<T> | RemoteApiFailure

export async function remoteApi<T>(method: string, args?: Record<string, unknown>): Promise<RemoteApiResult<T>> {
  try {
    const response = await fetch(`/remote-ssh/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
      body: JSON.stringify(args ?? {})
    })
    const payload = (await response.json()) as { ok?: boolean; value?: T; error?: { message?: string } }
    if (payload && payload.ok) return { ok: true, value: payload.value as T }
    return { ok: false, error: payload?.error?.message || `HTTP ${response.status}` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
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
