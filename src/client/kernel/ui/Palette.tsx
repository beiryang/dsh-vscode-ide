/**
 * 快速打开 / 命令面板（Ctrl+P、Ctrl+Shift+P）。
 *
 * 一个组件两种数据源：输入以 `>` 开头切到命令，否则搜文件。
 * 键盘：↑↓ 选择、Enter 执行、Esc 关闭。
 */

import * as React from 'react'

import { h } from '../../h'
import { listCommands, runCommand } from '../commands'
import { cachedFiles, loadFiles, type FileHit } from '../files'
import { palette } from '../palette'
import { registry } from '../registry'

type Item = {
  id: string
  label: string
  detail?: string
  hint?: string
  run: () => void
}

/** 子序列匹配打分：连续命中加分，越长越靠后扣分 */
function score(text: string, query: string): number {
  if (!query) return 1
  const haystack = text.toLowerCase()
  const needle = query.toLowerCase()
  let ti = 0
  let qi = 0
  let streak = 0
  let total = 0
  while (ti < haystack.length && qi < needle.length) {
    if (haystack[ti] === needle[qi]) {
      streak += 1
      total += 1 + streak
      qi += 1
    } else {
      streak = 0
    }
    ti += 1
  }
  if (qi < needle.length) return -1
  return total - (haystack.length - needle.length) * 0.01
}

export function Palette() {
  const state = React.useSyncExternalStore(palette.subscribe, palette.getSnapshot)
  const [query, setQuery] = React.useState('')
  const [cursor, setCursor] = React.useState(0)
  const [files, setFiles] = React.useState<FileHit[]>(cachedFiles())
  const [loading, setLoading] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const isPick = state.mode === 'pick'
  const commandsMode = !isPick && query.startsWith('>')
  const needle = (commandsMode ? query.slice(1) : query).trim()

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      setFiles(await loadFiles())
    } catch {
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!state.open) return
    setQuery(state.mode === 'commands' ? '>' : '')
    setCursor(0)
    if (state.mode !== 'commands') void refresh()
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [state.open, state.mode, refresh])

  const items = React.useMemo<Item[]>(() => {
    if (commandsMode) {
      return listCommands()
        .map((command) => ({
          command,
          score: score(`${command.category ?? ''} ${command.title}`, needle)
        }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 80)
        .map(({ command }) => ({
          id: command.id,
          label: command.title,
          detail: command.category,
          hint: command.keybinding,
          run: () => void runCommand(command.id)
        }))
    }

    return files
      .map((file) => ({ file, score: score(file.rel, needle) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 80)
      .map(({ file }) => ({
        id: file.path,
        label: file.name,
        detail: file.rel,
        run: isPick ? () => state.onPick?.(file.path) : () => registry.openFile(file.path, { name: file.name })
      }))
  }, [commandsMode, needle, files, isPick, state.onPick])

  React.useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(0, items.length - 1)))
  }, [items.length])

  if (!state.open) return null

  const run = (item: Item | undefined) => {
    if (!item) return
    palette.close()
    item.run()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((current) => (items.length === 0 ? 0 : (current + 1) % items.length))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((current) => (items.length === 0 ? 0 : (current - 1 + items.length) % items.length))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      run(items[cursor])
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      palette.close()
    }
  }

  return h(
    'div',
    {
      className: 'dsv-palette-mask',
      onMouseDown: (event: React.MouseEvent) => {
        if (event.target === event.currentTarget) palette.close()
      }
    },
    h(
      'div',
      { className: 'dsv-palette', 'data-mode': isPick ? 'pick' : commandsMode ? 'commands' : 'files' },
      h('input', {
        ref: inputRef,
        className: 'dsv-palette-input',
        value: query,
        spellCheck: false,
        placeholder: isPick
          ? state.title || '选择一个文件'
          : commandsMode
            ? '输入命令…'
            : '按文件名搜索，输入 > 切到命令',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          setQuery(event.target.value)
          setCursor(0)
        },
        onKeyDown
      }),
      h(
        'div',
        { className: 'dsv-palette-list' },
        items.length === 0
          ? h('div', { className: 'dsv-palette-empty' }, loading ? '正在建立文件索引…' : commandsMode ? '没有匹配的命令' : '没有匹配的文件')
          : items.map((item, index) =>
              h(
                'div',
                {
                  key: item.id,
                  className: 'dsv-palette-item',
                  'data-active': index === cursor ? 'true' : 'false',
                  onMouseEnter: () => setCursor(index),
                  onMouseDown: (event: React.MouseEvent) => {
                    event.preventDefault()
                    run(item)
                  }
                },
                h('span', { className: 'dsv-palette-label' }, item.label),
                item.detail ? h('span', { className: 'dsv-palette-detail' }, item.detail) : null,
                item.hint ? h('span', { className: 'dsv-palette-hint' }, item.hint) : null
              )
            )
      ),
      h(
        'div',
        { className: 'dsv-palette-foot' },
        h('span', null, commandsMode ? '命令' : `${isPick ? '选择' : '文件'} ${files.length} 个${loading ? '（刷新中）' : ''}`),
        h('span', { style: { flex: 1 } }),
        h('span', null, isPick ? '↑↓ 选择 · Enter 确认 · Esc 取消' : '↑↓ 选择 · Enter 执行 · Esc 关闭')
      )
    )
  )
}
