/**
 * 状态栏信息：分支、光标位置、语言、行尾。
 *
 * 内核自己的小 store：各 feature 写入，Window 订阅显示。
 * （内核不反向依赖 feature，所以数据从这里汇合。）
 */

export type StatusInfo = {
  branch?: string | null
  ahead?: number
  behind?: number
  line?: number
  column?: number
  language?: string
  eol?: string
}

let info: StatusInfo = {}
const listeners = new Set<() => void>()

export const statusInfo = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  getSnapshot(): StatusInfo {
    return info
  },

  set(patch: Partial<StatusInfo>): void {
    let changed = false
    const next: StatusInfo = { ...info }
    for (const key of Object.keys(patch) as Array<keyof StatusInfo>) {
      const value = patch[key]
      if (value === undefined) continue
      if ((next as Record<string, unknown>)[key] !== value) {
        ;(next as Record<string, unknown>)[key] = value
        changed = true
      }
    }
    if (!changed) return
    info = next
    for (const listener of listeners) listener()
  },

  reset(): void {
    info = {}
    for (const listener of listeners) listener()
  }
}
