/**
 * 主题桥。
 *
 * 壳**只读** DSH 的 `--dsw-alias-*` 变量（一个都不写），把它们映射成自己的
 * `--dsv-*` 变量层；壳的 CSS 只消费 `--dsv-*`。
 *
 * 这一层是给 Phase 2 的「VS Code 主题」留的接口：将来把一份主题 JSON 的
 * `colors` 映射成同一组 `--dsv-*` 即可整壳换肤，编辑器再用同一份数据调
 * `monaco.editor.defineTheme`。
 */

import { shellPaletteOf, themeStore } from './themes'

const DARK_FALLBACK = {
  bg: '#1e1e1e',
  panel: '#252526',
  panelAlt: '#2d2d30',
  elevated: '#3c3c3c',
  fg: '#cccccc',
  fgDim: '#9d9d9d',
  fgFaint: '#6e6e6e',
  border: '#3c3c3c',
  borderSoft: '#2b2b2b',
  accent: '#0078d4',
  hover: 'rgba(255,255,255,0.06)',
  input: '#1b1b1b'
}

const LIGHT_FALLBACK = {
  bg: '#ffffff',
  panel: '#f3f3f3',
  panelAlt: '#ececec',
  elevated: '#ffffff',
  fg: '#1f1f1f',
  fgDim: '#5f5f5f',
  fgFaint: '#8a8a8a',
  border: '#d6d6d6',
  borderSoft: '#e6e6e6',
  accent: '#0066bf',
  hover: 'rgba(0,0,0,0.05)',
  input: '#f8f8f8'
}

/** 变量名 → DSH 变量候选（按顺序取第一个非空值） */
const MAP: Array<[string, string[]]> = [
  ['--dsv-bg', ['--dsw-alias-bg-base', '--dsw-alias-bg-layer-1']],
  ['--dsv-panel', ['--dsw-alias-bg-layer-2']],
  ['--dsv-panel-alt', ['--dsw-alias-bg-layer-3', '--dsw-alias-fill-tinted']],
  ['--dsv-elevated', ['--dsw-alias-bg-elevated']],
  ['--dsv-fg', ['--dsw-alias-label-primary']],
  ['--dsv-fg-dim', ['--dsw-alias-label-secondary']],
  ['--dsv-fg-faint', ['--dsw-alias-label-tertiary']],
  ['--dsv-border', ['--dsw-alias-border-l2', '--dsw-alias-border-l1']],
  ['--dsv-border-soft', ['--dsw-alias-border-l1']],
  ['--dsv-accent', ['--dsw-alias-brand', '--dsw-alias-button-primary-fill']],
  ['--dsv-hover', ['--dsw-alias-interactive-bg-hover']],
  ['--dsv-mono', ['--dsh-font-family-code', '--dsw-font-family-code']]
]

function luminance(color: string): number {
  const match = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(color)
  if (!match) return 0
  const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])]
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

export function isDark(): boolean {
  const body = document.body
  if (!body) return true
  if (body.hasAttribute('data-ds-dark-theme')) return true
  const scheme = getComputedStyle(body).colorScheme || ''
  if (scheme.includes('dark')) return true
  const bg = getComputedStyle(body).backgroundColor
  if (bg && bg !== 'rgba(0, 0, 0, 0)') return luminance(bg) < 0.5
  return true
}

export function applyTheme(root: HTMLElement | null) {
  if (!root || !document.body) return

  // 选中了内置主题：外壳与编辑器都用这份主题的配色
  const custom = themeStore.editorTheme()
  if (custom) {
    const palette = shellPaletteOf(custom)
    root.style.setProperty('--dsv-bg', palette.bg)
    root.style.setProperty('--dsv-panel', palette.panel)
    root.style.setProperty('--dsv-panel-alt', palette.panelAlt)
    root.style.setProperty('--dsv-elevated', palette.elevated)
    root.style.setProperty('--dsv-fg', palette.fg)
    root.style.setProperty('--dsv-fg-dim', palette.fgDim)
    root.style.setProperty('--dsv-fg-faint', palette.fgFaint)
    root.style.setProperty('--dsv-border', palette.border)
    root.style.setProperty('--dsv-border-soft', palette.borderSoft)
    root.style.setProperty('--dsv-accent', palette.accent)
    root.style.setProperty('--dsv-hover', palette.hover)
    root.style.setProperty('--dsv-input', palette.input)
    root.setAttribute('data-dsv-theme', 'dark')
    return
  }

  const bodyStyle = getComputedStyle(document.body)
  const dark = isDark()
  const fallback = dark ? DARK_FALLBACK : LIGHT_FALLBACK

  const set = (name: string, value: string) => {
    if (value) root.style.setProperty(name, value)
    else root.style.removeProperty(name)
  }

  for (const [target, sources] of MAP) {
    let value = ''
    for (const source of sources) {
      const candidate = bodyStyle.getPropertyValue(source).trim()
      if (candidate) {
        value = candidate
        break
      }
    }
    set(target, value)
  }

  root.setAttribute('data-dsv-theme', dark ? 'dark' : 'light')

  // 兜底：DSH 没有提供某个变量时，用本套调色板补上（写在 CSS 里也行，
  // 但内联变量优先级更确定，主题切换时不会残留上一套颜色）
  const fills: Record<string, string> = {
    '--dsv-bg': fallback.bg,
    '--dsv-panel': fallback.panel,
    '--dsv-panel-alt': fallback.panelAlt,
    '--dsv-elevated': fallback.elevated,
    '--dsv-fg': fallback.fg,
    '--dsv-fg-dim': fallback.fgDim,
    '--dsv-fg-faint': fallback.fgFaint,
    '--dsv-border': fallback.border,
    '--dsv-border-soft': fallback.borderSoft,
    '--dsv-accent': fallback.accent,
    '--dsv-hover': fallback.hover,
    '--dsv-input': fallback.input
  }
  for (const [name, value] of Object.entries(fills)) {
    if (!root.style.getPropertyValue(name)) root.style.setProperty(name, value)
  }
}

/** 监听 DSH 的深浅色切换（body 属性变化）并重新取色 */
export function watchTheme(root: HTMLElement | null, onAfter?: () => void): () => void {
  if (!root || typeof MutationObserver === 'undefined') return () => {}
  let timer = 0
  const refresh = () => {
    applyTheme(root)
    try {
      onAfter?.()
    } catch {
      /* 订阅方异常不影响主题刷新 */
    }
  }
  const observer = new MutationObserver(() => {
    window.clearTimeout(timer)
    timer = window.setTimeout(refresh, 30)
  })
  observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-ds-dark-theme', 'style'] })
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  media?.addEventListener?.('change', refresh)
  return () => {
    observer.disconnect()
    window.clearTimeout(timer)
    media?.removeEventListener?.('change', refresh)
  }
}
