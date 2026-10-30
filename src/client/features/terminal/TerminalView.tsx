/**
 * 单个终端视图：xterm 实例 + 输出流 + 输入回传。
 *
 * 输出走 GET /term/stream（NDJSON 长连接），输入走 POST /term/write。
 */

import * as React from 'react'

import { h } from '../../h'
import { api } from '../../kernel/transport'
import { terminal, type TermSession } from './terminal'
import { loadXterm } from './loader'
import { terminalFontFamily, terminalFontSize, terminalTheme, trackTerminal } from './theme'

function base64ToBytes(base64: string): Uint8Array {
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function pump(id: string, term: any, signal: AbortSignal) {
  const response = await fetch(`/dsh-vscode-ide/term/stream?id=${encodeURIComponent(id)}`, {
    signal,
    cache: 'no-store'
  })
  if (!response.ok || !response.body) {
    let detail = ''
    try {
      detail = (await response.text()).slice(0, 200)
    } catch {
      /* ignore */
    }
    throw new Error(`终端流不可用（HTTP ${response.status}）${detail ? '：' + detail : ''}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let at = buffer.indexOf('\n')
    while (at >= 0) {
      const line = buffer.slice(0, at).trim()
      buffer = buffer.slice(at + 1)
      at = buffer.indexOf('\n')
      if (!line) continue
      try {
        const message = JSON.parse(line) as { t: string; d?: string }
        if (message.t === 'd' && message.d) term.write(base64ToBytes(message.d))
        else if (message.t === 'x') {
          term.write('\r\n\x1b[90m[会话已结束]\x1b[0m\r\n')
          terminal.markClosed(id)
        }
      } catch {
        /* 忽略坏行 */
      }
    }
  }
}

/** 已创建终端实例（sessionId → xterm），供右键菜单做复制/粘贴/全选 */
export const termRegistry = new Map<string, any>()

export function TerminalView({ session, active }: { session: TermSession; active: boolean }) {
  const hostRef = React.useRef<HTMLDivElement | null>(null)
  const termRef = React.useRef<any>(null)
  const fitRef = React.useRef<any>(null)

  React.useEffect(() => {
    const element = hostRef.current
    if (!element) return

    let disposed = false
    let term: any = null
    let observer: ResizeObserver | null = null
    let untrack: (() => void) | null = null
    const controller = new AbortController()

    void loadXterm()
      .then(({ Terminal, FitAddon }) => {
        if (disposed) return
        term = new Terminal({
          cursorBlink: true,
          fontSize: terminalFontSize(),
          fontFamily: terminalFontFamily(),
          lineHeight: 1.15,
          allowProposedApi: true,
          scrollback: 5000,
          theme: terminalTheme()
        })
        const fit = new FitAddon()
        term.loadAddon(fit)
        term.open(element)
        untrack = trackTerminal(term, () => {
          try {
            fit.fit()
          } catch {
            /* ignore */
          }
        })
        termRef.current = term
        termRegistry.set(session.id, term)
        fitRef.current = fit
        try {
          fit.fit()
        } catch {
          /* 容器还没尺寸 */
        }
        // 初次 fit 后必须立刻把真实列/行数告诉 PTY：
        // 否则 PowerShell 仍按打开时的旧宽度排版，表格每行被补到旧宽度，
        // xterm 端再折行 —— 表现就是每一行表格后面夹一个空行。
        if (term.cols > 0 && term.rows > 0) {
          void api.termResize(session.id, term.cols, term.rows).catch(() => undefined)
        }
        term.onData((data: string) => {
          void api.termWrite(session.id, data).catch(() => undefined)
        })

        observer = new ResizeObserver(() => {
          if (!term || disposed) return
          try {
            fit.fit()
            void api.termResize(session.id, term.cols, term.rows).catch(() => undefined)
          } catch {
            /* ignore */
          }
        })
        observer.observe(element)

        void pump(session.id, term, controller.signal).catch((error) => {
          if (!disposed) term?.writeln?.(`\r\n\x1b[31m${error instanceof Error ? error.message : String(error)}\x1b[0m`)
        })
        term.focus()
      })
      .catch((error) => {
        if (!disposed) element.textContent = `终端加载失败：${error instanceof Error ? error.message : String(error)}`
      })

    return () => {
      disposed = true
      controller.abort()
      observer?.disconnect()
      untrack?.()
      untrack = null
      try {
        term?.dispose()
      } catch {
        /* ignore */
      }
      termRegistry.delete(session.id)
      termRef.current = null
      fitRef.current = null
    }
  }, [session.id])

  React.useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => {
      try {
        fitRef.current?.fit()
    const term = termRef.current
    if (term) void api.termResize(session.id, term.cols, term.rows).catch(() => undefined)
        termRef.current?.focus()
      } catch {
        /* ignore */
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [active])

  return h('div', {
    className: 'dsv-term-view',
    'data-active': active ? 'true' : 'false',
    'data-session': session.id,
    ref: hostRef
  })
}
