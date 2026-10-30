/**
 * 远程连接状态：Code Space 打开时自动探测一次默认连接，
 * 用绿色/灰色圆点表示「最近一次探测是否连通」。
 */

import { remoteApi } from './api'

type Profile = { id: string; name?: string; host?: string; user?: string }

let state: Record<string, boolean> = {}
const listeners = new Set<() => void>()
let probing: Promise<void> | null = null
let probed = false

function emit() {
  for (const listener of listeners) listener()
}

export const remoteStatus = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot(): Record<string, boolean> {
    return state
  },
  mark(id: string, ok: boolean) {
    if (state[id] === ok) return
    state = { ...state, [id]: ok }
    emit()
  },
  reset() {
    state = {}
    emit()
  }
}

/** 只探测一次：默认取第一个连接，失败再试下一个；任一成功即停止 */
export function ensureAutoProbe(): Promise<void> {
  if (probed) return probing ?? Promise.resolve()
  probed = true
  probing = (async () => {
    const list = await remoteApi<{ profiles: Profile[] }>('listProfiles', undefined, 8000)
    if (!list.ok) return
    for (const profile of list.value.profiles ?? []) {
      const result = await remoteApi<{ warning?: string }>('testConnection', { id: profile.id }, 45000)
      remoteStatus.mark(profile.id, result.ok)
      if (result.ok) break
    }
  })().finally(() => {
    probing = null
  })
  return probing
}
