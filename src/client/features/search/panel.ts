/**
 * 搜索面板的开关状态（浮层，不是常驻侧栏标签）。
 *
 * 模仿 VS Code 的 Ctrl+Shift+F：需要时才出现，Esc / 点别处即收起，
 * 不会长期占着侧栏，也不跟资源管理器抢位置。
 */

const listeners = new Set<() => void>()
let open = false

function publish(next: boolean) {
  if (next === open) return
  open = next
  for (const listener of listeners) listener()
}

export const searchPanel = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot(): boolean {
    return open
  },
  open() {
    publish(true)
    // 等浮层挂载后再聚焦输入框
    requestAnimationFrame(() => window.dispatchEvent(new Event('dsv:focus-search')))
  },
  close() {
    publish(false)
  },
  toggle() {
    if (open) this.close()
    else this.open()
  }
}
