/**
 * 本地命令控制台（PowerShell，基于管道，不是 PTY）。
 *
 * 为什么不用 xterm：没有 PTY 就没有输入回显与行编辑，xterm 里会变成"盲打"。
 * 所以这里用「输出区 + 输入行」的形态：命令由用户在自己看得到的输入框里敲，
 * Enter 才整行发给 shell，输出流式追加。
 *
 * 已知限制（面板里也会提示）：不能跑 vim/top 这类全屏交互程序。
 */

import * as React from 'react'

import { h } from '../../h'
import { api } from '../../kernel/transport'
import { terminal, type TermSession } from './terminal'

function decodeBase64(base64: string): string {
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/** 去掉 ANSI 控制序列，纯文本输出区不需要颜色 */
function stripAnsi(text: string): string {
  return text
    .replace(/\u001b\][^\u0007]*\u0007/g, '')
    .replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

const MAX_OUTPUT = 200000

export function LocalConsole({ session, active }: { session: TermSession; active: boolean }) {
  const [output, setOutput] = React.useState('')
  const [line, setLine] = React.useState('')
  const [history, setHistory] = React.useState<string[]>([])
  const [historyAt, setHistoryAt] = React.useState(-1)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const outputRef = React.useRef<HTMLPreElement | null>(null)

  React.useEffect(() => {
    const controller = new AbortController()
    let buffer = ''

    void (async () => {
      const response = await fetch(`/dsh-vscode-ide/term/stream?id=${encodeURIComponent(session.id)}`, {
        signal: controller.signal,
        cache: 'no-store'
      })
      if (!response.ok || !response.body) {
        setOutput((prev) => `${prev}\n[输出流不可用 HTTP ${response.status}]\n`)
        return
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let at = buffer.indexOf('\n')
        while (at >= 0) {
          const raw = buffer.slice(0, at).trim()
          buffer = buffer.slice(at + 1)
          at = buffer.indexOf('\n')
          if (!raw) continue
          try {
            const message = JSON.parse(raw) as { t: string; d?: string }
            if (message.t === 'd' && message.d) {
              const text = stripAnsi(decodeBase64(message.d))
              setOutput((prev) => (prev + text).slice(-MAX_OUTPUT))
            } else if (message.t === 'x') {
              setOutput((prev) => `${prev}\n[会话已结束]\n`)
            }
          } catch {
            /* 忽略坏行 */
          }
        }
      }
    })().catch(() => undefined)

    return () => controller.abort()
  }, [session.id])

  React.useEffect(() => {
    const element = outputRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [output])

  React.useEffect(() => {
    if (active) inputRef.current?.focus()
  }, [active])

  const run = () => {
    const command = line
    if (!command.trim()) {
      setLine('')
      return
    }
    setOutput((prev) => `${prev}${prev.endsWith('\n') || prev === '' ? '' : '\n'}PS> ${command}\n`.slice(-MAX_OUTPUT))
    setHistory((prev) => [command, ...prev].slice(0, 100))
    setHistoryAt(-1)
    setLine('')
    void api.termWrite(session.id, command).catch((error) => {
      setOutput((prev) => `${prev}\n[发送失败] ${error instanceof Error ? error.message : String(error)}\n`)
    })
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      run()
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const next = Math.min(historyAt + 1, history.length - 1)
      if (next >= 0) {
        setHistoryAt(next)
        setLine(history[next])
      }
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = historyAt - 1
      setHistoryAt(next)
      setLine(next >= 0 ? history[next] : '')
      return
    }
    if (event.key === 'l' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      setOutput('')
    }
  }

  return h(
    'div',
    { className: 'dsv-term-view dsv-local', 'data-active': active ? 'true' : 'false' },
    h('pre', { className: 'dsv-local-out', ref: outputRef }, output || '（本地 PowerShell 控制台）'),
    h(
      'div',
      { className: 'dsv-local-input-row' },
      h('span', { className: 'dsv-local-prompt' }, 'PS>'),
      h('input', {
        ref: inputRef,
        className: 'dsv-local-input',
        value: line,
        spellCheck: false,
        placeholder: '输入命令后回车（↑↓ 历史，Ctrl+L 清屏；不支持 vim/top 等全屏程序）',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setLine(event.target.value),
        onKeyDown
      }),
      h('button', { className: 'dsv-mini-btn', title: '清屏', onClick: () => setOutput('') }, '清'),
      h('button', { className: 'dsv-mini-btn', title: '关闭', onClick: () => void terminal.closeSession(session.id) }, '✕')
    )
  )
}
