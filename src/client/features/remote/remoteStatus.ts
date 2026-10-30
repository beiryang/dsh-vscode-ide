/**
 * 远程连接状态：Code Space 打开时探测一次，打开远程面板时再重新探测；
 * 所有连接并行测试，各自显示绿/灰圆点。
 */

import { remoteApi } from './api'

type Profile = { id: string; name?: string; host?: string; user?: string }

let state: Record<string, boolean> = {}
const listeners = new Set<() => void>()
let inflight: Promise<void> | null = null
let probedOnce = false

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

/** 并行探测所有连接，每个连接独立更新时间 */
export function probeAll(): Promise<void> {
  if (inflight) return inflight
  inflight = (async () => {
    const list = await remoteApi<{ profiles: Profile[] }>('listProfiles', undefined, 8000)
    if (!list.ok) return
    const queue = (list.value.profiles ?? []).slice()
    const worker = async () => {
      for (;;) {
        const profile = queue.shift()
        if (!profile) return
        const result = await remoteApi<{ warning?: string }>('testConnection', { id: profile.id }, 45000)
        remoteStatus.mark(profile.id, result.ok)
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker))
  })().finally(() => {
    inflight = null
  })
  return inflight
}

/** 启动时只探测一次（Code Space 窗口挂载） */
export function ensureAutoProbe(): Promise<void> {
  if (probedOnce) return Promise.resolve()
  probedOnce = true
  return probeAll()
}
