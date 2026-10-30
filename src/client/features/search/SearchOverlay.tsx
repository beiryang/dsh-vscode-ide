/** 搜索浮层：可拖动 + 可调整大小 + 关闭按钮；只在用户主动关闭时消失。 */

import * as React from 'react'

import { h } from '../../h'
import type { WorkbenchContext } from '../../kernel/registry'
import { searchPanel } from './panel'
import { SearchView } from './SearchView'

const POSITION_KEY = 'dsv:search.position.v1'
const SIZE_KEY = 'dsv:search.size.v1'

type Position = { x: number; y: number }
type Size = { w: number; h: number }

function loadPosition(): Position | null {
  try {
    const raw = localStorage.getItem(POSITION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Position
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

function loadSize(): Size | null {
  try {
    const raw = localStorage.getItem(SIZE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Size
    if (typeof parsed.w !== 'number' || typeof parsed.h !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export function SearchOverlay({ ctx }: { ctx: WorkbenchContext }) {
  const open = React.useSyncExternalStore(searchPanel.subscribe, searchPanel.getSnapshot)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = React.useState<Position | null>(() => loadPosition())
  const [size, setSize] = React.useState<Size | null>(() => loadSize())
  const dragRef = React.useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const resizeRef = React.useRef<{ startX: number; startY: number; width: number; height: number } | null>(null)

  // Esc 关闭（显式用户操作）
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      searchPanel.close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  // 打开时把记住的位置/尺寸夹回视口内（窗口尺寸可能变了）
  React.useEffect(() => {
    if (!open || !rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    if (pos) {
      const x = Math.max(0, Math.min(pos.x, window.innerWidth - rect.width - 4))
      const y = Math.max(0, Math.min(pos.y, window.innerHeight - rect.height - 4))
      if (x !== pos.x || y !== pos.y) setPos({ x, y })
    }
    if (size) {
      const w = Math.max(360, Math.min(size.w, window.innerWidth - 8))
      const h = Math.max(220, Math.min(size.h, window.innerHeight - 8))
      if (w !== size.w || h !== size.h) setSize({ w, h })
    }
  }, [open, pos, size])

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { startX: event.clientX, startY: event.clientY, originX: rect.left, originY: rect.top }
    setPos({ x: rect.left, y: rect.top })
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }

  const onDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || !rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    const nextX = Math.max(0, Math.min(drag.originX + event.clientX - drag.startX, window.innerWidth - rect.width - 4))
    const nextY = Math.max(0, Math.min(drag.originY + event.clientY - drag.startY, window.innerHeight - rect.height - 4))
    setPos({ x: nextX, y: nextY })
  }

  const endDrag = () => {
    if (!dragRef.current) return
    dragRef.current = null
    setPos((current) => {
      if (current) persist(POSITION_KEY, current)
      return current
    })
  }

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return
    resizeRef.current = { startX: event.clientX, startY: event.clientY, width: rect.width, height: rect.height }
    setPos({ x: rect.left, y: rect.top })
    setSize({ w: rect.width, h: rect.height })
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.stopPropagation()
    event.preventDefault()
  }

  const onResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current
    if (!resize) return
    const maxW = window.innerWidth - (pos?.x ?? 0) - 4
    const maxH = window.innerHeight - (pos?.y ?? 0) - 4
    const w = Math.max(360, Math.min(resize.width + event.clientX - resize.startX, maxW))
    const h = Math.max(220, Math.min(resize.height + event.clientY - resize.startY, maxH))
    setSize({ w, h })
  }

  const endResize = () => {
    if (!resizeRef.current) return
    resizeRef.current = null
    setSize((current) => {
      if (current) persist(SIZE_KEY, current)
      return current
    })
  }

  if (!open) return null

  const style: React.CSSProperties = {}
  if (pos) {
    style.left = `${pos.x}px`
    style.top = `${pos.y}px`
    style.transform = 'none'
  }
  if (size) {
    style.width = `${size.w}px`
    style.height = `${size.h}px`
    style.maxHeight = 'none'
  }

  return h(
    'div',
    {
      className: 'dsv-search-overlay',
      ref: rootRef,
      'data-dsv-search-overlay': 'true',
      style
    },
    h(
      'div',
      {
        className: 'dsv-search-dragbar',
        onPointerDown: startDrag,
        onPointerMove: onDragMove,
        onPointerUp: endDrag,
        onPointerCancel: endDrag
      },
      h('span', { className: 'dsv-search-grip', title: '拖动标题栏移动搜索框' }, '⠿'),
      h('span', { className: 'dsv-search-dragtitle' }, '搜索'),
      h('span', { style: { flex: 1 } }),
      h(
        'button',
        {
          className: 'dsv-search-close',
          title: '关闭搜索（Esc）',
          onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
          onClick: () => searchPanel.close()
        },
        '✕'
      )
    ),
    h(SearchView, { ctx }),
    h('div', {
      className: 'dsv-search-resizer',
      title: '拖动调整大小',
      onPointerDown: startResize,
      onPointerMove: onResizeMove,
      onPointerUp: endResize,
      onPointerCancel: endResize
    })
  )
}
