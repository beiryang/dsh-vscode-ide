/**
 * 快速打开 / 命令面板 / 选文件 的开关状态。
 * 三种模式共用同一个面板组件，只换数据源和「回车之后做什么」。
 */

export type PaletteMode = 'files' | 'commands' | 'pick'

export type PaletteState = {
  open: boolean
  mode: PaletteMode
  /** pick 模式下的标题提示 */
  title?: string
  /** pick 模式下选中文件后的回调 */
  onPick?: (path: string) => void
}

let state: PaletteState = { open: false, mode: 'files' }
const listeners = new Set<() => void>()

function publish(next: PaletteState) {
  state = next
  for (const listener of listeners) listener()
}

export const palette = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot(): PaletteState {
    return state
  },
  open(mode: PaletteMode = 'files') {
    publish({ open: true, mode })
  },
  /** 选一个文件（diff 等需要两个文件的操作会连着用两次） */
  pick(title: string, onPick: (path: string) => void) {
    publish({ open: true, mode: 'pick', title, onPick })
  },
  close() {
    if (state.open) publish({ open: false, mode: state.mode })
  },
  toggle(mode: PaletteMode = 'files') {
    if (state.open && state.mode === mode) palette.close()
    else publish({ open: true, mode })
  },
  setMode(mode: PaletteMode) {
    if (state.open && state.mode !== mode) publish({ open: true, mode })
  }
}
