/**
 * 主题定义与选择。
 *
 * 一份主题同时负责两件事：
 *   1. 编辑器：Monaco 的 rules（语法高亮）+ colors
 *   2. 工作台外壳：映射成 --dsv-* 变量（侧栏、标签、状态栏、面板）
 *
 * 所以换一个主题 = 整个工作台换皮，而不仅是编辑区。
 * 目前内置「跟随 DSH」与「One Dark Pro」（按 One Dark 调色板手写的等价实现，
 * 见 README 的第三方资源说明）。
 */

export type ThemeId = 'follow' | 'one-dark' | 'custom'

export type TokenRule = { token: string; foreground?: string; fontStyle?: string }

export type EditorTheme = {
  id: string
  label: string
  base: 'vs' | 'vs-dark'
  /** VS Code 风格的 color key → 颜色；外壳变量会从这些值里推导 */
  colors: Record<string, string>
  rules: TokenRule[]
}

const ONE_DARK_RULES: TokenRule[] = [
  { token: 'comment', foreground: '5C6370', fontStyle: 'italic' },
  { token: 'keyword', foreground: 'C678DD' },
  { token: 'keyword.control', foreground: 'C678DD' },
  { token: 'string', foreground: '98C379' },
  { token: 'number', foreground: 'D19A66' },
  { token: 'regexp', foreground: '56B6C2' },
  { token: 'type', foreground: 'E5C07B' },
  { token: 'type.identifier', foreground: 'E5C07B' },
  { token: 'identifier', foreground: 'ABB2BF' },
  { token: 'delimiter', foreground: 'ABB2BF' },
  { token: 'operator', foreground: '56B6C2' },
  { token: 'tag', foreground: 'E06C75' },
  { token: 'attribute.name', foreground: 'D19A66' },
  { token: 'attribute.value', foreground: '98C379' },
  { token: 'variable', foreground: 'E06C75' },
  { token: 'constant', foreground: 'D19A66' },
  { token: 'annotation', foreground: 'D19A66' },
  { token: 'invalid', foreground: 'F44747' }
]

export const ONE_DARK: EditorTheme = {
  id: 'dsv-one-dark',
  label: 'One Dark Pro',
  base: 'vs-dark',
  colors: {
    'editor.background': '#282C34',
    'editor.foreground': '#ABB2BF',
    'editorCursor.foreground': '#528BFF',
    'editorLineNumber.foreground': '#4B5263',
    'editorLineNumber.activeForeground': '#ABB2BF',
    'editor.selectionBackground': '#3E4451',
    'editor.lineHighlightBackground': '#2C313A',
    'editorWidget.background': '#21252B',
    'editorWidget.border': '#181A1F',
    'sideBar.background': '#21252B',
    'activityBar.background': '#21252B',
    'titleBar.activeBackground': '#21252B',
    'statusBar.background': '#21252B',
    'statusBar.foreground': '#9DA5B4',
    'tab.activeBackground': '#282C34',
    'tab.inactiveBackground': '#21252B',
    'list.hoverBackground': '#2C313A',
    'focusBorder': '#528BFF'
  },
  rules: ONE_DARK_RULES
}

/** 外壳变量：由主题的 colors 推导，缺的走兜底 */
export type ShellPalette = {
  bg: string
  panel: string
  panelAlt: string
  elevated: string
  fg: string
  fgDim: string
  fgFaint: string
  border: string
  borderSoft: string
  accent: string
  hover: string
  input: string
}

export function shellPaletteOf(theme: EditorTheme): ShellPalette {
  const c = theme.colors
  return {
    bg: c['editor.background'] ?? '#282c34',
    panel: c['sideBar.background'] ?? '#21252b',
    panelAlt: c['list.hoverBackground'] ?? '#2c313a',
    elevated: c['editorWidget.background'] ?? '#21252b',
    fg: c['editor.foreground'] ?? '#abb2bf',
    fgDim: '#9da5b4',
    fgFaint: '#5c6370',
    border: c['editorWidget.border'] ?? '#181a1f',
    borderSoft: c['editorWidget.border'] ?? '#181a1f',
    accent: c['focusBorder'] ?? '#528bff',
    hover: 'rgba(255,255,255,0.07)',
    input: '#1b1e24'
  }
}

const KEY = 'dsv:theme.v1'
const CUSTOM_KEY = 'dsv:theme.custom.v1'
const listeners = new Set<() => void>()
let current: ThemeId = 'follow'
let custom: EditorTheme | null = null

/** 恢复用户导入的自定义主题 */
try {
  const raw = localStorage.getItem(CUSTOM_KEY)
  if (raw) {
    const saved = JSON.parse(raw) as { name?: string; type?: 'dark' | 'light'; colors?: Record<string, string>; rules?: TokenRule[] }
    if (saved && saved.colors && typeof saved.colors === 'object') {
      custom = {
        id: 'dsv-custom',
        label: saved.name || '自定义主题',
        base: saved.type === 'light' ? 'vs' : 'vs-dark',
        colors: saved.colors,
        rules: Array.isArray(saved.rules) ? saved.rules : []
      }
    }
  }
} catch {
  custom = null
}

try {
  const saved = localStorage.getItem(KEY)
  if (saved === 'one-dark' || saved === 'follow' || saved === 'custom') current = saved
} catch {
  /* localStorage 不可用时用默认值 */
}

function persistActive() {
  try {
    localStorage.setItem(KEY, current)
  } catch {
    /* ignore */
  }
}

export const themeStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot(): ThemeId {
    return current
  },
  set(id: ThemeId) {
    if (id === current) return
    current = id
    persistActive()
    for (const listener of listeners) listener()
  },
  /** 当前生效的编辑器主题（follow 时返回 null，表示用内置深浅两套） */
  editorTheme(): EditorTheme | null {
    if (current === 'custom') return custom
    return current === 'one-dark' ? ONE_DARK : null
  },
  /** 导入并启用自定义主题（供设置页调用） */
  setCustom(theme: { name: string; type: 'dark' | 'light'; colors: Record<string, string>; rules: TokenRule[] }) {
    custom = {
      id: 'dsv-custom',
      label: theme.name || '自定义主题',
      base: theme.type === 'light' ? 'vs' : 'vs-dark',
      colors: theme.colors,
      rules: theme.rules ?? []
    }
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify({ name: custom.label, type: theme.type, colors: theme.colors, rules: custom.rules }))
    } catch {
      /* 存不下就只在本次会话生效 */
    }
    current = 'custom'
    persistActive()
    for (const listener of listeners) listener()
  },
  clearCustom() {
    custom = null
    try {
      localStorage.removeItem(CUSTOM_KEY)
    } catch {
      /* ignore */
    }
    if (current === 'custom') {
      current = 'follow'
      persistActive()
    }
    for (const listener of listeners) listener()
  },
  customTheme(): EditorTheme | null {
    return custom
  }
}
