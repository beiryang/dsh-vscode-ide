/**
 * 侧栏视图选择（内核状态）。
 *
 * 让别的地方（比如左侧入口的 Codespace 按钮）能把侧栏切到指定视图。
 */

const listeners = new Set<() => void>()
let activeId = ''

function publish(next: string) {
  if (next === activeId) return
  activeId = next
  for (const listener of listeners) listener()
}

export const sidebar = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot(): string {
    return activeId
  },
  setActive(id: string) {
    publish(id)
  }
}
