/**
 * 终端面板状态：开关、高度、会话列表。
 *
 * 会话本身在宿主侧（SSH shell）；这里只保存 UI 需要的元数据。
 * 高度和开关存 localStorage（`dsv:terminal.v1`）。
 */

import { api } from '../../kernel/transport'

export type TermStatus = 'connecting' | 'ready' | 'closed' | 'error'

export type TermKind = 'ssh' | 'local'

export type TermSession = {
  id: string
  label: string
  status: TermStatus
  /** ssh = 真 PTY 的远程终端；local = 本地 PowerShell 命令控制台 */
  kind: TermKind
  message?: string
}

export type TerminalState = {
  open: boolean
  height: number
  width: number
  sessions: TermSession[]
  activeId: string | null
}

const KEY = 'dsv:terminal.v1'
export const MIN_TERM_HEIGHT = 8
export const MAX_TERM_HEIGHT = 1600
export const MIN_TERM_WIDTH = 320
export const MAX_TERM_WIDTH = 900

function load(): TerminalState {
  let height = 240
  let width = 420
  let open = false
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { v?: number; height?: number; width?: number; open?: boolean }
      if (parsed.v === 1) {
        if (typeof parsed.height === 'number') height = clampHeight(parsed.height)
        if (typeof parsed.width === 'number') width = clampWidth(parsed.width)
        open = parsed.open === true
      }
    }
  } catch {
    /* ignore */
  }
  return { open, height, width, sessions: [], activeId: null }
}

function clampWidth(value: number) {
  const max = Math.min(MAX_TERM_WIDTH, Math.max(MIN_TERM_WIDTH, Math.round(window.innerWidth * 0.5)))
  return Math.min(Math.max(Math.round(value), MIN_TERM_WIDTH), max)
}

function clampHeight(value: number) {
  const max = Math.min(MAX_TERM_HEIGHT, Math.max(MIN_TERM_HEIGHT, window.innerHeight - 32))
  return Math.min(Math.max(Math.round(value), MIN_TERM_HEIGHT), max)
}

let state: TerminalState = load()
const listeners = new Set<() => void>()

function publish(next: Partial<TerminalState>) {
  state = { ...state, ...next }
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, height: state.height, width: state.width, open: state.open }))
  } catch {
    /* ignore */
  }
  for (const listener of listeners) listener()
}

export const terminal = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot(): TerminalState {
    return state
  },
  open() {
    if (!state.open) publish({ open: true })
  },
  close() {
    if (state.open) publish({ open: false })
  },
  toggle() {
    publish({ open: !state.open })
  },
  setWidth(width: number) {
    publish({ width: clampWidth(width) })
  },
  setHeight(height: number) {
    publish({ height: clampHeight(height) })
  },
  setActive(id: string) {
    publish({ activeId: id })
  },

  /** 新建一个 SSH 终端（先开面板，再连）；返回错误信息，成功返回 null */
  async create(ssh?: { host: string; port?: number; user: string; keyPath?: string; password?: string; passphrase?: string }): Promise<string | null> {
    terminal.open()
    const placeholder: TermSession = {
      id: `pending-${Date.now()}`,
      label: '正在连接…',
      status: 'connecting',
      kind: 'ssh'
    }
    publish({ sessions: [...state.sessions, placeholder], activeId: placeholder.id })
    try {
      const session = await api.termOpen(100, 28, ssh)
      publish({
        sessions: state.sessions.map((item) =>
          item.id === placeholder.id ? { id: session.id, label: session.label, status: 'ready', kind: 'ssh' } : item
        ),
        activeId: session.id
      })
      return null
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      publish({
        sessions: state.sessions.map((item) =>
          item.id === placeholder.id ? { ...item, status: 'error', message } : item
        )
      })
      return message
    }
  },

  /** 新建一个本地 PowerShell 命令控制台（非 PTY） */
  async createLocal(): Promise<void> {
    terminal.open()
    const placeholder: TermSession = {
      id: `pending-local-${Date.now()}`,
      label: '正在启动 PowerShell…',
      status: 'connecting',
      kind: 'local'
    }
    publish({ sessions: [...state.sessions, placeholder], activeId: placeholder.id })
    try {
      const session = await api.localOpen()
      publish({
        sessions: state.sessions.map((item) =>
          item.id === placeholder.id ? { id: session.id, label: session.label, status: 'ready', kind: 'local' } : item
        ),
        activeId: session.id
      })
    } catch (error) {
      publish({
        sessions: state.sessions.map((item) =>
          item.id === placeholder.id
            ? { ...item, status: 'error', message: error instanceof Error ? error.message : String(error) }
            : item
        )
      })
    }
  },

  async closeSession(id: string) {
    const next = state.sessions.filter((item) => item.id !== id)
    const activeId = state.activeId === id ? (next[next.length - 1]?.id ?? null) : state.activeId
    publish({ sessions: next, activeId })
    if (!id.startsWith('pending-')) {
      try {
        await api.termClose(id)
      } catch {
        /* 连接可能已经断了 */
      }
    }
  },

  markClosed(id: string) {
    publish({
      sessions: state.sessions.map((item) => (item.id === id ? { ...item, status: 'closed' } : item))
    })
  }
}
