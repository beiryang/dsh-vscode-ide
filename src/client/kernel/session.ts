/**
 * 会话绑定：跟踪 `uiSession.adapter.current` 的变化。
 *
 * 踩过的坑：DSH 在启动/切换工作区时会**重建 session surface**，
 * 也就是说 `adapter.current` 这个 store 对象本身会被换掉。只在启动时
 * 抓一次引用并订阅，之后就再也收不到更新 —— 表现就是「刚打开工作台
 * 读不到工作区，手动点几次会话才恢复」。
 *
 * 所以这里每秒重新取一次 adapter，发现对象变了就重新订阅。
 */

import { setSessionId } from './transport'

type AnyCtx = { get?: (name: string) => any }

let current = ''
const listeners = new Set<() => void>()

function publish(id: string) {
  if (id === current) return
  current = id
  setSessionId(id)
  for (const listener of listeners) listener()
}

export const sessionStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot(): string {
    return current
  }
}

export function connectSession(ctx: AnyCtx): () => void {
  let adapter: any = null
  let off: (() => void) | undefined

  const currentAdapter = () => {
    try {
      return ctx?.get?.('uiSession')?.adapter?.current
    } catch {
      return undefined
    }
  }

  const sync = () => {
    const next = currentAdapter()
    if (next !== adapter) {
      try {
        off?.()
      } catch {
        /* ignore */
      }
      off = undefined
      adapter = next
      try {
        if (adapter && typeof adapter.subscribe === 'function') off = adapter.subscribe(sync)
      } catch {
        off = undefined
      }
    }

    let key = ''
    try {
      const value = adapter?.getSnapshot?.()?.key
      if (typeof value === 'string') key = value
    } catch {
      key = ''
    }
    publish(key)
  }

  sync()
  const timer = window.setInterval(sync, 1000)
  return () => {
    if (typeof off === 'function') off()
    window.clearInterval(timer)
  }
}
