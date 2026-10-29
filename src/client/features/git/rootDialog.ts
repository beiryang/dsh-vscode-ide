/** 「选择 Git 仓库目录」对话框状态。 */

const listeners = new Set<() => void>()
let open = false

function publish(next: boolean) {
  if (next === open) return
  open = next
  for (const listener of listeners) listener()
}

export const gitRootDialog = {
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
  },
  close() {
    publish(false)
  }
}
