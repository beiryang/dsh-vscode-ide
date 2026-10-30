/**
 * 「问题」面板：汇总 Monaco 各模型的诊断（语法 / 类型 / lint）。
 *
 * 数据由编辑器 feature 在标记变化时写入；面板本身是浮层，
 * Esc 或点空白处收起，点条目跳到对应文件行。
 */

export type ProblemSeverity = 'error' | 'warning' | 'info' | 'hint'

export type Problem = {
  path: string
  name: string
  line: number
  column: number
  severity: ProblemSeverity
  message: string
  source: string
}

const listeners = new Set<() => void>()
let items: Problem[] = []
let open = false

function emit() {
  for (const listener of listeners) listener()
}

export const problemsStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot(): Problem[] {
    return items
  },
  set(next: Problem[]): void {
    items = next
    emit()
  },
  clear(): void {
    if (items.length === 0) return
    items = []
    emit()
  }
}

export const problemsPanel = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot(): boolean {
    return open
  },
  open(): void {
    if (open) return
    open = true
    emit()
  },
  close(): void {
    if (!open) return
    open = false
    emit()
  },
  toggle(): void {
    open = !open
    emit()
  }
}
