/**
 * 编辑器主题：从壳的 --dsv-* 变量生成 Monaco 主题。
 *
 * 这一版只做「深/浅两套 + 关键色跟随 DSH」，token 颜色用一套紧凑的
 * VS Code 风格映射；完整的主题包（VS Code JSON 导入）放 Phase 2。
 */

import { isDark } from '../../../kernel/theme'
import { themeStore } from '../../../kernel/themes'

/** 大类别 token 着色（Monarch 只产出这些粗粒度 scope） */
const RULES = [
  { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
  { token: 'keyword', foreground: '569CD6' },
  { token: 'keyword.control', foreground: 'C586C0' },
  { token: 'string', foreground: 'CE9178' },
  { token: 'number', foreground: 'B5CEA8' },
  { token: 'regexp', foreground: 'D16969' },
  { token: 'type', foreground: '4EC9B0' },
  { token: 'type.identifier', foreground: '4EC9B0' },
  { token: 'identifier', foreground: '9CDCFE' },
  { token: 'delimiter', foreground: 'D4D4D4' },
  { token: 'operator', foreground: 'D4D4D4' },
  { token: 'tag', foreground: '569CD6' },
  { token: 'attribute.name', foreground: '9CDCFE' },
  { token: 'attribute.value', foreground: 'CE9178' },
  { token: 'variable', foreground: '9CDCFE' },
  { token: 'constant', foreground: '4FC1FF' },
  { token: 'annotation', foreground: 'DCDCAA' },
  { token: 'invalid', foreground: 'F44747' }
]

function read(host: HTMLElement, name: string, fallback: string): string {
  const value = getComputedStyle(host).getPropertyValue(name).trim()
  return value || fallback
}

export const DARK_THEME = 'dsv-dark'
export const LIGHT_THEME = 'dsv-light'

let hostRef: HTMLElement | null = null

export function themeName(): string {
  const custom = themeStore.editorTheme()
  if (custom) return custom.id
  return isDark() ? DARK_THEME : LIGHT_THEME
}

/**
 * 定义两套主题（幂等）。颜色全部来自壳的变量层：
 * 换主题时只要改 --dsv-* 再调 setTheme 即可。
 */
export function defineThemes(monaco: any, host: HTMLElement) {
  // 变量挂在 .dsv-root 上，传进来的 host 可能拿不到：统一从壳根元素读
  const shellRoot = (document.querySelector('[data-dsv-root]') as HTMLElement | null) ?? host
  host = shellRoot
  hostRef = host
  const dark = isDark()

  const bg = read(host, '--dsv-bg', dark ? '#1e1e1e' : '#ffffff')
  const panel = read(host, '--dsv-panel', dark ? '#252526' : '#f3f3f3')
  const fg = read(host, '--dsv-fg', dark ? '#cccccc' : '#1f1f1f')
  const dim = read(host, '--dsv-fg-dim', dark ? '#9d9d9d' : '#5f5f5f')
  const faint = read(host, '--dsv-fg-faint', dark ? '#6e6e6e' : '#8a8a8a')
  const border = read(host, '--dsv-border', dark ? '#3c3c3c' : '#d6d6d6')
  const accent = read(host, '--dsv-accent', '#0078d4')

  const widget = {
    'editorWidget.background': panel,
    'editorWidget.border': border,
    'editorSuggestWidget.background': panel,
    'editorSuggestWidget.border': border,
    'editorHoverWidget.background': panel,
    'editorHoverWidget.border': border,
    'input.background': dark ? '#1b1b1b' : '#ffffff',
    'focusBorder': accent
  }

  const common = {
    'editor.background': bg,
    'editor.foreground': fg,
    'editorCursor.foreground': accent,
    'editor.lineHighlightBackground': dark ? '#ffffff0a' : '#00000008',
    'editorLineNumber.foreground': faint,
    'editorLineNumber.activeForeground': dim,
    'editorIndentGuide.background1': dark ? '#ffffff14' : '#00000012',
    'editorIndentGuide.activeBackground1': dark ? '#ffffff2b' : '#00000026',
    'editor.selectionBackground': dark ? '#264f78' : '#add6ff',
    'editor.inactiveSelectionBackground': dark ? '#3a3d41' : '#e5ebf1',
    'editor.selectionHighlightBackground': dark ? '#add6ff26' : '#add6ff66',
    'editorBracketMatch.background': dark ? '#0064001a' : '#0064001a',
    'editorBracketMatch.border': dark ? '#888888' : '#888888',
    'editorGutter.background': bg,
    'minimap.background': bg,
    'scrollbarSlider.background': dark ? '#79797966' : '#64646466',
    'scrollbarSlider.hoverBackground': dark ? '#646464b3' : '#646464b3',
    'scrollbarSlider.activeBackground': dark ? '#bfbfbf66' : '#bfbfbf66',
    'editorOverviewRuler.border': '#00000000',
    ...widget
  }

  monaco.editor.defineTheme(DARK_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: RULES,
    colors: { ...common, 'editor.background': '#1e1e1e', 'editorGutter.background': '#1e1e1e', 'minimap.background': '#1e1e1e' }
  })

  monaco.editor.defineTheme(LIGHT_THEME, {
    base: 'vs',
    inherit: true,
    rules: RULES,
    colors: { ...common, 'editor.background': '#ffffff', 'editorGutter.background': '#ffffff', 'minimap.background': '#ffffff' }
  })

  // 内置主题（One Dark Pro 等）：同一份 colors 覆盖到编辑器上
  const custom = themeStore.editorTheme()
  if (custom) {
    monaco.editor.defineTheme(custom.id, {
      base: custom.base,
      inherit: true,
      rules: custom.rules,
      colors: { ...common, ...custom.colors }
    })
  }
}

/** 深浅切换 / 主题切换时调用（幂等，不重建编辑器） */
export function syncTheme(monaco: any) {
  try {
    if (hostRef) defineThemes(monaco, hostRef)
    monaco.editor.setTheme(themeName())
  } catch {
    /* 主题设置失败不影响编辑 */
  }
}
