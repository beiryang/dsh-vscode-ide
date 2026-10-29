/**
 * 文件树：按需展开（只列当前层），点击文件交给上层打开。
 * 支持右键菜单（新建/重命名/删除/复制路径/在资源管理器中显示）与刷新。
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

type MenuState = { x: number; y: number; entry: Entry | null; parentDir: string }
type DialogState = {
  kind: 'newFile' | 'newDir' | 'rename' | 'delete'
  target: Entry | null
  parentDir: string
  value: string
}

function formatSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function parentOf(path: string): string {
  const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return at > 0 ? path.slice(0, at) : path
}

function joinPath(dir: string, name: string): string {
  const sep = dir.includes('\\') ? '\\' : '/'
  return `${dir.replace(/[\\/]+$/, '')}${sep}${name}`
}

export function FileTree(props: Props) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const [children, setChildren] = React.useState<Map<string, Entry[]>>(new Map())
  const [loading, setLoading] = React.useState<Set<string>>(new Set())
  const [error, setError] = React.useState<string | null>(null)
  const [menu, setMenu] = React.useState<MenuState | null>(null)
  const [dialog, setDialog] = React.useState<DialogState | null>(null)
  const [busy, setBusy] = React.useState(false)

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

  React.useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [menu])

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

  const refresh = React.useCallback(() => {
    const dirs = children.size > 0 ? [...children.keys()] : props.cwd ? [props.cwd] : []
    for (const dir of dirs) void load(dir)
  }, [children, load, props.cwd])

  const openMenu = (event: React.MouseEvent, entry: Entry | null, parentDir: string) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, entry, parentDir })
  }

  const submitDialog = async () => {
    if (!dialog || busy) return
    const value = dialog.value.trim()
    setBusy(true)
    try {
      if (dialog.kind === 'newFile' || dialog.kind === 'newDir') {
        if (!value) return
        const target = joinPath(dialog.parentDir, value)
        await api.createEntry(target, dialog.kind === 'newDir')
        await load(dialog.parentDir)
        setExpanded((prev) => new Set(prev).add(dialog.parentDir))
      } else if (dialog.kind === 'rename' && dialog.target) {
        if (!value) return
        await api.renameEntry(dialog.target.path, value)
        await load(dialog.parentDir)
      } else if (dialog.kind === 'delete' && dialog.target) {
        await api.deleteEntry(dialog.target.path)
        await load(dialog.parentDir)
      }
      setDialog(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

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
            onClick: () => (entry.dir ? toggle(entry) : props.onOpen(entry)),
            onContextMenu: (event: React.MouseEvent) => openMenu(event, entry, entry.dir ? entry.path : parentOf(entry.path))
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

  const menuEntry = menu?.entry ?? null

  return h(
    'div',
    { className: 'dsv-panel' },
    h(
      'div',
      { className: 'dsv-panel-head' },
      h('span', null, '资源管理器'),
      h('span', { style: { flex: 1 } }),
      props.cwd && error ? h('span', { title: error, style: { color: '#e06c75' } }, '出错') : null,
      h('button', { className: 'dsv-mini-btn', title: '刷新', onClick: refresh }, '↻')
    ),
    h(
      'div',
      {
        className: 'dsv-tree',
        onContextMenu: (event: React.MouseEvent) => {
          if (event.target !== event.currentTarget) return
          if (props.cwd) openMenu(event, null, props.cwd)
        }
      },
      props.cwd ? null : h('div', { className: 'dsv-tree-note' }, '未检测到工作区：先在 DSH 里打开一个会话'),
      error ? h('div', { className: 'dsv-tree-error' }, error) : null,
      props.cwd ? renderEntries(props.cwd, 0) : null
    ),

    /* 右键菜单 */
    menu
      ? h(
          'div',
          {
            className: 'dsv-tree-menu',
            style: { left: `${menu.x}px`, top: `${menu.y}px` },
            onPointerDown: (event: React.PointerEvent) => event.stopPropagation()
          },
          menuEntry
            ? h(
                'button',
                {
                  className: 'dsv-tree-menu-item',
                  onClick: () => {
                    setDialog({ kind: 'rename', target: menuEntry, parentDir: menu.parentDir, value: menuEntry.name })
                    setMenu(null)
                  }
                },
                '重命名…'
              )
            : null,
          h(
            'button',
            {
              className: 'dsv-tree-menu-item',
              onClick: () => {
                setDialog({ kind: 'newFile', target: null, parentDir: menu.parentDir, value: '' })
                setMenu(null)
              }
            },
            '新建文件…'
          ),
          h(
            'button',
            {
              className: 'dsv-tree-menu-item',
              onClick: () => {
                setDialog({ kind: 'newDir', target: null, parentDir: menu.parentDir, value: '' })
                setMenu(null)
              }
            },
            '新建文件夹…'
          ),
          menuEntry
            ? h(
                'button',
                {
                  className: 'dsv-tree-menu-item',
                  onClick: () => {
                    void navigator.clipboard?.writeText(menuEntry.path).catch(() => undefined)
                    setMenu(null)
                  }
                },
                '复制路径'
              )
            : null,
          menuEntry
            ? h(
                'button',
                {
                  className: 'dsv-tree-menu-item',
                  onClick: () => {
                    void api.revealEntry(menuEntry.path).catch(() => undefined)
                    setMenu(null)
                  }
                },
                '在资源管理器中显示'
              )
            : null,
          menuEntry
            ? h(
                'button',
                {
                  className: 'dsv-tree-menu-item',
                  'data-danger': 'true',
                  onClick: () => {
                    setDialog({ kind: 'delete', target: menuEntry, parentDir: menu.parentDir, value: '' })
                    setMenu(null)
                  }
                },
                '删除'
              )
            : null
        )
      : null,

    /* 输入/确认对话框 */
    dialog
      ? h(
          'div',
          { className: 'dsv-tree-dialog-backdrop', onPointerDown: () => !busy && setDialog(null) },
          h(
            'div',
            { className: 'dsv-tree-dialog', onPointerDown: (event: React.PointerEvent) => event.stopPropagation() },
            h(
              'div',
              { className: 'dsv-tree-dialog-title' },
              dialog.kind === 'newFile'
                ? '新建文件'
                : dialog.kind === 'newDir'
                  ? '新建文件夹'
                  : dialog.kind === 'rename'
                    ? '重命名'
                    : '删除'
            ),
            dialog.kind === 'delete'
              ? h(
                  'div',
                  { className: 'dsv-tree-dialog-text' },
                  `确定删除「${dialog.target?.name ?? ''}」吗？${dialog.target?.dir ? '（目录会连同内容一起删除）' : ''}`
                )
              : h('input', {
                  className: 'dsv-tree-dialog-input',
                  value: dialog.value,
                  autoFocus: true,
                  spellCheck: false,
                  placeholder: '输入名称',
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                    setDialog({ ...dialog, value: (event.target as HTMLInputElement).value }),
                  onKeyDown: (event: React.KeyboardEvent) => {
                    if (event.key === 'Enter') void submitDialog()
                    if (event.key === 'Escape') setDialog(null)
                  }
                }),
            h(
              'div',
              { className: 'dsv-tree-dialog-actions' },
              h('button', { className: 'dsv-tree-dialog-btn', disabled: busy, onClick: () => setDialog(null) }, '取消'),
              h(
                'button',
                {
                  className: 'dsv-tree-dialog-btn',
                  'data-primary': 'true',
                  disabled: busy || (dialog.kind !== 'delete' && !dialog.value.trim()),
                  onClick: () => void submitDialog()
                },
                busy ? '…' : '确定'
              )
            )
          )
        )
      : null
  )
}
