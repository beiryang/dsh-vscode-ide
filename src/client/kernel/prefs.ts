/**
 * 工作台偏好设置（小、持久、可订阅）。
 *
 * 存储：`dsv:prefs.v1`（JSON）
 *
 * 目前有：终端字号、编辑器字体。以后编辑器字号/行高之类的偏好也都往这里加，
 * 免得每个 feature 各写一套 localStorage。
 */

export type Prefs = {
  /** 终端（xterm）字号，px */
  terminalFontSize: number
  /** 编辑器（Monaco）字体族，CSS font-family 写法 */
  editorFontFamily: string
  /** 编辑器字号，px */
  editorFontSize: number
  /** 编辑器自动换行 */
  editorWordWrap: boolean
  /** Tab 宽度（空格数） */
  editorTabSize: number
  /** 显示行号 */
  editorLineNumbers: boolean
  /** 底部面板停靠位置：右侧（占满高度）或底部 */
  panelDock: 'right' | 'bottom'
}

/**
 * 默认编辑器字体：中英文统一用 Maple Mono NF CN Light。
 * （早先是「英文 Maple + 中文文楷」的混合方案，文楷卸载后不再需要；
 * 老用户 localStorage 里存着的混合栈会在读取时自动迁移掉。）
 */
export const DEFAULT_EDITOR_FONT =
  '"Maple Mono NF CN Light", "Maple Mono NF CN", "Cascadia Mono", Consolas, monospace'

/** 设置页下拉里给出的候选（只是建议，输入框可以填任意字体） */
export const EDITOR_FONT_CANDIDATES = [
  'Maple Mono NF CN Light',
  'Maple Mono NF CN',
  'Sarasa Mono SC',
  'JetBrains Mono',
  'Fira Code',
  'Cascadia Mono',
  'Consolas',
  'Menlo',
  'ui-monospace'
]

export const DEFAULT_PREFS: Prefs = {
  terminalFontSize: 12,
  editorFontFamily: DEFAULT_EDITOR_FONT,
  editorFontSize: 13,
  editorWordWrap: false,
  editorTabSize: 2,
  editorLineNumbers: true,
  panelDock: 'bottom'
}

export const TERMINAL_FONT_MIN = 10
export const TERMINAL_FONT_MAX = 20
export const EDITOR_FONT_MIN = 10
export const EDITOR_FONT_MAX = 24
export const EDITOR_TAB_MIN = 1
export const EDITOR_TAB_MAX = 8
const MAX_FONT_LENGTH = 300

const KEY = 'dsv:prefs.v1'
const listeners = new Set<() => void>()

function clampFontSize(value: unknown): number {
  const size = Math.round(Number(value))
  if (!Number.isFinite(size)) return DEFAULT_PREFS.terminalFontSize
  return Math.min(TERMINAL_FONT_MAX, Math.max(TERMINAL_FONT_MIN, size))
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const size = Math.round(Number(value))
  if (!Number.isFinite(size)) return fallback
  return Math.min(max, Math.max(min, size))
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeFontFamily(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_EDITOR_FONT
  const trimmed = value.trim().slice(0, MAX_FONT_LENGTH)
  if (!trimmed) return DEFAULT_EDITOR_FONT
  // 用户只填一个字体名（没写引号/逗号）时自动补引号，CSS 才能识别带空格的族名
  if (!trimmed.includes(',') && !trimmed.includes('"') && !trimmed.includes("'")) return `"${trimmed}"`
  return trimmed
}

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      terminalFontSize: clampFontSize(parsed.terminalFontSize ?? DEFAULT_PREFS.terminalFontSize),
      editorFontFamily: migrateFontFamily(parsed.editorFontFamily),
      editorFontSize: clampNumber(parsed.editorFontSize, EDITOR_FONT_MIN, EDITOR_FONT_MAX, DEFAULT_PREFS.editorFontSize),
      editorWordWrap: asBoolean(parsed.editorWordWrap, DEFAULT_PREFS.editorWordWrap),
      editorTabSize: clampNumber(parsed.editorTabSize, EDITOR_TAB_MIN, EDITOR_TAB_MAX, DEFAULT_PREFS.editorTabSize),
      editorLineNumbers: asBoolean(parsed.editorLineNumbers, DEFAULT_PREFS.editorLineNumbers),
      panelDock: parsed.panelDock === 'right' ? 'right' : 'bottom'
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

/**
 * 迁移：早期默认值是「英文 Maple + 中文文楷」的混合栈。
 * 文楷不再作为默认（用户已卸载），把存量的这一项摘掉；
 * 用户自己填过的字体不受影响。
 */
function migrateFontFamily(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_EDITOR_FONT
  if (!value.includes('LXGW WenKai')) return normalizeFontFamily(value)
  const cleaned = value
    .replace(/"?LXGW WenKai Mono Medium"?\s*,?\s*/g, '')
    .replace(/,\s*$/, '')
    .trim()
  return cleaned ? normalizeFontFamily(cleaned) : DEFAULT_EDITOR_FONT
}

let state: Prefs = load()

function publish(next: Prefs) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* 存储不可用就只保留内存态 */
  }
  prefs.version += 1
  for (const listener of listeners) listener()
}

export const prefs = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot(): Prefs {
    return state
  },
  set(patch: Partial<Prefs>) {
    publish({
      ...state,
      ...patch,
      terminalFontSize: clampFontSize(patch.terminalFontSize ?? state.terminalFontSize),
      editorFontFamily: normalizeFontFamily(patch.editorFontFamily ?? state.editorFontFamily),
      editorFontSize: clampNumber(patch.editorFontSize ?? state.editorFontSize, EDITOR_FONT_MIN, EDITOR_FONT_MAX, state.editorFontSize),
      editorWordWrap: asBoolean(patch.editorWordWrap ?? state.editorWordWrap, state.editorWordWrap),
      editorTabSize: clampNumber(patch.editorTabSize ?? state.editorTabSize, EDITOR_TAB_MIN, EDITOR_TAB_MAX, state.editorTabSize),
      editorLineNumbers: asBoolean(patch.editorLineNumbers ?? state.editorLineNumbers, state.editorLineNumbers)
    })
  },
  setTerminalFontSize(size: number) {
    publish({ ...state, terminalFontSize: clampFontSize(size) })
  },
  setEditorFontFamily(family: string) {
    publish({ ...state, editorFontFamily: normalizeFontFamily(family) })
  },
  setEditorFontSize(size: number) {
    publish({ ...state, editorFontSize: clampNumber(size, EDITOR_FONT_MIN, EDITOR_FONT_MAX, state.editorFontSize) })
  },
  setEditorTabSize(size: number) {
    publish({ ...state, editorTabSize: clampNumber(size, EDITOR_TAB_MIN, EDITOR_TAB_MAX, state.editorTabSize) })
  },
  setEditorWordWrap(value: boolean) {
    publish({ ...state, editorWordWrap: value })
  },
  setEditorLineNumbers(value: boolean) {
    publish({ ...state, editorLineNumbers: value })
  },
  setPanelDock(dock: 'right' | 'bottom') {
    publish({ ...state, panelDock: dock === 'bottom' ? 'bottom' : 'right' })
  },
  resetEditorFontFamily() {
    publish({ ...state, editorFontFamily: DEFAULT_EDITOR_FONT })
  },
  /** 版本号，给 useSyncExternalStore 当快照用 */
  version: 0
}
