/**
 * 文件树：按需展开（只列当前层），点击文件交给上层打开。
 * Phase 0 的职责只有两个：验证宿主文件 API，和给编辑器一个入口。
 */

import * as React from 'react'

import { h } from '../../h'
import { api, type Entry } from '../../kernel/transport'
import { FileIcon } from './FileIcon'

type Props = {
  cwd: string | null
  activePath: string | null
  onOpen: (entry: Entry) => void
}

function formatSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function FileTree(props: Props) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const [children, setChildren] = React.useState<Map<string, Entry[]>>(new Map())
  const [loading, setLoading] = React.useState<Set<string>>(new Set())
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async (path: string) => {
    setLoading((prev) => new Set(prev).add(path))
    try {
      const listing = await api.list(path)
      setChildren((prev) => {
        const next = new Map(prev)
        next.set(path, listing.entries)
        return next
      })
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading((prev) => {
        const next = new Set(prev)
        next.delete(path)
        return next
      })
    }
  }, [])

  React.useEffect(() => {
    if (!props.cwd) {
      setChildren(new Map())
      setExpanded(new Set())
      return
    }
    setExpanded(new Set([props.cwd]))
    setChildren(new Map())
    void load(props.cwd)
  }, [props.cwd, load])

  const toggle = React.useCallback(
    (entry: Entry) => {
      setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(entry.path)) {
          next.delete(entry.path)
        } else {
          next.add(entry.path)
          if (!children.has(entry.path)) void load(entry.path)
        }
        return next
      })
    },
    [children, load]
  )

  function renderEntries(dir: string, depth: number): React.ReactNode[] {
    const entries = children.get(dir)
    if (!entries) {
      return loading.has(dir)
        ? [h('div', { key: `${dir}:loading`, className: 'dsv-tree-note', style: { paddingLeft: `${12 + depth * 12}px` } }, '加载中…')]
        : []
    }
    if (entries.length === 0) {
      return [h('div', { key: `${dir}:empty`, className: 'dsv-tree-note', style: { paddingLeft: `${12 + depth * 12}px` } }, '空目录')]
    }

    const rows: React.ReactNode[] = []
    for (const entry of entries) {
      const open = expanded.has(entry.path)
      rows.push(
        h(
          'div',
          {
            key: entry.path,
            className: 'dsv-tree-row',
            'data-dir': entry.dir ? 'true' : 'false',
            'data-active': entry.path === props.activePath ? 'true' : 'false',
            style: { paddingLeft: `${6 + depth * 12}px` },
            title: entry.path,
            onClick: () => (entry.dir ? toggle(entry) : props.onOpen(entry))
          },
          h('span', { className: 'dsv-caret' }, entry.dir ? (open ? '▾' : '▸') : ''),
          h(FileIcon, { name: entry.name, dir: entry.dir, expanded: open }),
          h('span', { className: 'dsv-tree-name' }, entry.name),
          entry.dir ? null : h('span', { className: 'dsv-tree-size' }, formatSize(entry.size))
        )
      )
      if (entry.dir && open) {
        rows.push(...renderEntries(entry.path, depth + 1))
      }
    }
    return rows
  }

  return h(
    'div',
    { className: 'dsv-panel' },
    h(
      'div',
      { className: 'dsv-panel-head' },
      h('span', null, '资源管理器'),
      h('span', { style: { flex: 1 } }),
      props.cwd && error ? h('span', { title: error, style: { color: '#e06c75' } }, '出错') : null
    ),
    h(
      'div',
      { className: 'dsv-tree' },
      props.cwd ? null : h('div', { className: 'dsv-tree-note' }, '未检测到工作区：先在 DSH 里打开一个会话'),
      error ? h('div', { className: 'dsv-tree-error' }, error) : null,
      props.cwd ? renderEntries(props.cwd, 0) : null
    )
  )
}
