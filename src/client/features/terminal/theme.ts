/**
 * 终端配色与字体。
 *
 * 之前 xterm 用的是 `document.body` 上读 CSS 变量 —— 而我们的变量层挂在
 * `.dsv-root` 上，读不到就退到写死的 #1e1e1e，所以和主题背景对不上。
 * 这里统一从壳根元素取色，并给 xterm 配一套完整的 ANSI 调色板。
 */

const FALLBACK_BG = '#1e1e1e'
const FALLBACK_FG = '#d4d4d4'

import { prefs } from '../../kernel/prefs'

/**
 * 字体链：优先 Nerd Font（Powerline 提示符需要），再退到等宽字体。
 * 用户机器上的 Maple Mono NF CN 自带 Nerd 图标；没有时用 Symbols Nerd Font
 * 兜底，避免出现方块乱码。
 */
export const TERMINAL_FONT =
  '"Maple Mono NF CN", "Maple Mono NF", "Symbols Nerd Font Mono", "Symbols Nerd Font", "Cascadia Mono", Consolas, "Courier New", monospace'

/** 当前字号由设置驱动（默认 12px），改设置后已打开的终端会立即跟着变 */
export function terminalFontSize(): number {
  return prefs.getSnapshot().terminalFontSize
}

function shellRoot(): HTMLElement | null {
  return document.querySelector('[data-dsv-root]') as HTMLElement | null
}

function cssVar(name: string, fallback: string): string {
  const root = shellRoot()
  if (!root) return fallback
  const value = getComputedStyle(root).getPropertyValue(name).trim()
  return value || fallback
}

/** One Dark 一系的高亮色，跟随主题时也仍然清晰 */
export function terminalTheme() {
  const background = cssVar('--dsv-bg', FALLBACK_BG)
  const foreground = cssVar('--dsv-fg', FALLBACK_FG)
  const accent = cssVar('--dsv-accent', '#528bff')
  return {
    background,
    foreground,
    cursor: accent,
    cursorAccent: background,
    selectionBackground: 'rgba(255,255,255,0.20)',
    selectionForeground: undefined,
    black: '#3f4451',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#e5c07b',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#dcdfe4',
    brightBlack: '#5c6370',
    brightRed: '#e06c75',
    brightGreen: '#98c379',
    brightYellow: '#e5c07b',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#ffffff'
  }
}

type TrackedTerminal = { term: any; refit?: () => void }

const terminals = new Set<TrackedTerminal>()

/** 登记终端实例，便于主题/字号切换时统一刷新 */
export function trackTerminal(term: unknown, refit?: () => void): () => void {
  const entry: TrackedTerminal = { term, refit }
  terminals.add(entry)
  return () => {
    terminals.delete(entry)
  }
}

export function syncTerminalTheme() {
  const theme = terminalTheme()
  for (const { term } of terminals) {
    try {
      term.options.theme = theme
    } catch {
      /* 终端可能已经销毁 */
    }
  }
}

/** 字号变化后：改 options 并重新 fit 一次（列数会变） */
export function syncTerminalFont() {
  const size = terminalFontSize()
  for (const { term, refit } of terminals) {
    try {
      term.options.fontSize = size
      refit?.()
    } catch {
      /* 终端可能已经销毁 */
    }
  }
}
