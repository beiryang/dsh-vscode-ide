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
  onOpen: (entry: Entry, options?: { preview?: boolean }) => void
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
  const [selected, setSelected] = React.useState<string | null>(null)
  const [dragging, setDragging] = React.useState<string | null>(null)
  const [dropTarget, setDropTarget] = React.useState<{ path: string; name: string } | null>(null)
  const [dragPos, setDragPos] = React.useState<{ x: number; y: number } | null>(null)
  const [dropRow, setDropRow] = React.useState<string | null>(null)
  const treeRef = React.useRef<HTMLDivElement | null>(null)
  const autoScrollRef = React.useRef<{ dir: number; speed: number; raf: number | null }>({ dir: 0, speed: 10, raf: null })

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

  /** 当前展开状态下可见的行（键盘上下移动用） */
  const visibleEntries = (): Entry[] => {
    const flat: Entry[] = []
    const walk = (dir: string) => {
      for (const entry of children.get(dir) ?? []) {
        flat.push(entry)
        if (entry.dir && expanded.has(entry.path)) walk(entry.path)
      }
    }
    if (props.cwd) walk(props.cwd)
    return flat
  }

  const moveInto = async (from: string, dir: string) => {
    if (!from || from === dir) return
    try {
      const result = await api.moveEntry(from, dir)
      if (!result.moved) return
      await load(parentOf(from))
      await load(dir)
      setExpanded((previous) => new Set(previous).add(dir))
      setSelected(result.path)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const onTreeKeyDown = (event: React.KeyboardEvent) => {
    const list = visibleEntries()
    if (list.length === 0) return
    const index = list.findIndex((item) => item.path === selected)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      const nextIndex = index < 0 ? 0 : Math.min(Math.max(index + delta, 0), list.length - 1)
      setSelected(list[nextIndex].path)
      return
    }
    const entry = index >= 0 ? list[index] : undefined
    if (!entry) return
    if (event.key === 'Enter') {
      event.preventDefault()
      if (entry.dir) toggle(entry)
      else props.onOpen(entry, { preview: false })
    } else if (event.key === 'Delete') {
      event.preventDefault()
      setDialog({ kind: 'delete', target: entry, parentDir: entry.dir ? entry.path : parentOf(entry.path), value: '' })
    } else if (event.key === 'F2') {
      event.preventDefault()
      setDialog({ kind: 'rename', target: entry, parentDir: entry.dir ? entry.path : parentOf(entry.path), value: entry.name })
    }
  }

  const stopAutoScroll = () => {
    const state = autoScrollRef.current
    state.dir = 0
    if (state.raf !== null) {
      cancelAnimationFrame(state.raf)
      state.raf = null
    }
  }

  const tickAutoScroll = () => {
    const state = autoScrollRef.current
    const element = treeRef.current
    if (!element || state.dir === 0) {
      state.raf = null
      return
    }
    element.scrollTop += state.dir * state.speed
    state.raf = requestAnimationFrame(tickAutoScroll)
  }

  /** 鼠标靠近树的上/下边缘时，用 requestAnimationFrame 持续滚动（不依赖 dragover 触发频率） */
  const updateAutoScroll = (clientY: number) => {
    const element = treeRef.current
    if (!element) return
    const box = element.getBoundingClientRect()
    const edge = 56
    const state = autoScrollRef.current
    if (clientY < box.top + edge) {
      state.dir = -1
      state.speed = Math.min(26, 8 + (box.top + edge - clientY) / 1.5)
    } else if (clientY > box.bottom - edge) {
      state.dir = 1
      state.speed = Math.min(26, 8 + (clientY - (box.bottom - edge)) / 1.5)
    } else {
      state.dir = 0
    }
    if (state.dir !== 0 && state.raf === null) state.raf = requestAnimationFrame(tickAutoScroll)
    if (state.dir === 0) stopAutoScroll()
  }

  const dirNameOf = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path

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
            'data-selected': entry.path === selected ? 'true' : 'false',
            draggable: true,
            style: { paddingLeft: `${6 + depth * 12}px` },
            title: entry.path,
            onClick: () => {
              setSelected(entry.path)
              if (entry.dir) toggle(entry)
              else props.onOpen(entry, { preview: true })
            },
            onDoubleClick: () => {
              if (!entry.dir) props.onOpen(entry, { preview: false })
            },
            onDragStart: (event: React.DragEvent) => {
              setDragging(entry.path)
              setDragPos({ x: event.clientX, y: event.clientY })
              try {
                event.dataTransfer.setData('text/plain', entry.path)
                event.dataTransfer.effectAllowed = 'move'
              } catch {
                /* ignore */
              }
            },
            'data-drop': dropRow === entry.path ? 'true' : 'false',
            onDragOver: (event: React.DragEvent) => {
              if (!dragging) return
              const targetDir = entry.dir ? entry.path : parentOf(entry.path)
              event.preventDefault()
              event.stopPropagation()
              updateAutoScroll(event.clientY)
              if (dragging === targetDir) {
                setDropRow(null)
                return
              }
              setDropRow(entry.path)
              setDropTarget({ path: targetDir, name: entry.dir ? entry.name : dirNameOf(targetDir) })
              setDragPos({ x: event.clientX, y: event.clientY })
            },
            onDrop: (event: React.DragEvent) => {
              event.preventDefault()
              event.stopPropagation()
              stopAutoScroll()
              const targetDir = entry.dir ? entry.path : parentOf(entry.path)
              const from = dragging ?? event.dataTransfer.getData('text/plain')
              setDragging(null)
              setDropTarget(null)
              setDropRow(null)
              setDragPos(null)
              if (from && from !== targetDir) void moveInto(from, targetDir)
            },
            onDragEnd: () => {
              stopAutoScroll()
              setDragging(null)
              setDropTarget(null)
              setDropRow(null)
              setDragPos(null)
            },
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
        tabIndex: 0,
        onClick: (event: React.MouseEvent) => (event.currentTarget as HTMLElement).focus(),
        onKeyDown: onTreeKeyDown,
        ref: treeRef,
        onDragOver: (event: React.DragEvent) => {
          if (!dragging) return
          event.preventDefault()
          setDragPos({ x: event.clientX, y: event.clientY })
          updateAutoScroll(event.clientY)
          if (event.target === event.currentTarget && props.cwd) {
            setDropRow(null)
            setDropTarget({ path: props.cwd, name: '工作区根目录' })
          }
        },
        onDragLeave: (event: React.DragEvent) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
          setDropTarget(null)
          setDropRow(null)
          stopAutoScroll()
        },
        onDrop: (event: React.DragEvent) => {
          if (!props.cwd) return
          event.preventDefault()
          const from = dragging ?? event.dataTransfer.getData('text/plain')
          stopAutoScroll()
          setDragging(null)
          setDropTarget(null)
          setDropRow(null)
          setDragPos(null)
          if (from) void moveInto(from, props.cwd)
        },
        onContextMenu: (event: React.MouseEvent) => {
          if (event.target !== event.currentTarget) return
          if (props.cwd) openMenu(event, null, props.cwd)
        }
      },
      props.cwd ? null : h('div', { className: 'dsv-tree-note' }, '未检测到工作区：先在 DSH 里打开一个会话'),
      error ? h('div', { className: 'dsv-tree-error' }, error) : null,
      props.cwd ? renderEntries(props.cwd, 0) : null
    ),

    /* 拖动时的落点提示 */
    dragging && dragPos
      ? h(
          'div',
          {
            className: 'dsv-drag-hint',
            style: { left: `${dragPos.x + 14}px`, top: `${dragPos.y + 14}px` }
          },
          dropTarget ? `移动到 ${dropTarget.name}` : '拖动到目录上松开即可移动'
        )
      : null,

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
