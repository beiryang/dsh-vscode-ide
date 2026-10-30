/** 搜索浮层：可拖动 + 关闭按钮；Esc / 点击外部仍可关闭。 */

import * as React from 'react'

import { h } from '../../h'
import type { WorkbenchContext } from '../../kernel/registry'
import { searchPanel } from './panel'
import { SearchView } from './SearchView'

const STORAGE_KEY = 'dsv:search.position.v1'

type Position = { x: number; y: number }

function loadPosition(): Position | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Position
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function SearchOverlay({ ctx }: { ctx: WorkbenchContext }) {
  const open = React.useSyncExternalStore(searchPanel.subscribe, searchPanel.getSnapshot)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = React.useState<Position | null>(() => loadPosition())
  const dragRef = React.useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)

  // Esc 关闭（app 的全局 Esc 会跳过搜索浮层里的按键，见 app.tsx）
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

  // 点击浮层外面关闭
  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (rootRef.current?.contains(target)) return
      searchPanel.close()
    }
    // 延迟挂载，避免打开那一下的同一个事件把面板关掉
    const timer = window.setTimeout(() => window.addEventListener('pointerdown', onPointerDown), 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  // 打开时把记住的位置夹回视口内（窗口尺寸可能变了）
  React.useEffect(() => {
    if (!open || !pos || !rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(pos.x, window.innerWidth - rect.width - 4))
    const y = Math.max(0, Math.min(pos.y, window.innerHeight - rect.height - 4))
    if (x !== pos.x || y !== pos.y) setPos({ x, y })
  }, [open, pos])

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return
    void rect
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
      if (current) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
        } catch {
          /* ignore */
        }
      }
      return current
    })
  }

  if (!open) return null

  return h(
    'div',
    {
      className: 'dsv-search-overlay',
      ref: rootRef,
      'data-dsv-search-overlay': 'true',
      style: pos ? { left: `${pos.x}px`, top: `${pos.y}px`, transform: 'none' } : undefined
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
    h(SearchView, { ctx })
  )
}
