/**
 * xterm.js 懒加载（和 Monaco 一样：不进客户端 bundle，用到时才 import）。
 */

const BASE = '/dsh-vscode-ide/assets/xterm'

type XtermModule = { Terminal: any; FitAddon: any }

let loading: Promise<XtermModule> | null = null

function ensureCss() {
  if (document.querySelector('link[data-dsv-xterm-css]')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `${BASE}/xterm.css`
  link.setAttribute('data-dsv-xterm-css', '')
  document.head.appendChild(link)
}

export function loadXterm(): Promise<XtermModule> {
  if (loading) return loading
  ensureCss()
  const url = `${BASE}/xterm.js`
  loading = import(/* @vite-ignore */ url).then((module) => {
    const mod = module as unknown as XtermModule
    if (!mod.Terminal) throw new Error('xterm.js 已加载但没有导出 Terminal')
    return mod
  })
  return loading
}
