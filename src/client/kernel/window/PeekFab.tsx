/**
 * 速览浮钮（peek FAB）。
 *
 * 作用等同 Ctrl+Alt+Q：
 *   - 工作台可见时显示「对话」，点一下把工作台藏起来看 DSH
 *   - 已经藏起来时变成「← 返回」，点一下原样回来
 *
 * 浮钮可以拖动，位置记在 localStorage（`dsv:fab.v1`）——每个人想放的地方不一样。
 */

import * as React from 'react'

import { h } from '../../h'
import { layout } from '../layout'

type Pos = { right: number; bottom: number }

const KEY = 'dsv:fab.v1'
const DEFAULT_POS: Pos = { right: 18, bottom: 56 }
const SIZE = 40

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_POS
    const parsed = JSON.parse(raw) as Partial<Pos>
    if (typeof parsed.right !== 'number' || typeof parsed.bottom !== 'number') return DEFAULT_POS
    return clampPos({ right: parsed.right, bottom: parsed.bottom })
  } catch {
    return DEFAULT_POS
  }
}

function clampPos(pos: Pos): Pos {
  const maxRight = Math.max(4, window.innerWidth - SIZE - 4)
  const maxBottom = Math.max(4, window.innerHeight - SIZE - 4)
  return {
    right: Math.min(Math.max(4, Math.round(pos.right)), maxRight),
    bottom: Math.min(Math.max(4, Math.round(pos.bottom)), maxBottom)
  }
}

export function PeekFab() {
  const state = React.useSyncExternalStore(layout.subscribe, layout.getSnapshot)
  const [pos, setPos] = React.useState<Pos>(DEFAULT_POS)
  const [dragging, setDragging] = React.useState(false)
  const movedRef = React.useRef(false)

  React.useEffect(() => {
    setPos(loadPos())
  }, [])

  if (!state.open) return null

  const save = (next: Pos) => {
    setPos(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    const startX = event.clientX
    const startY = event.clientY
    const start = { ...pos }
    movedRef.current = false
    setDragging(true)
    const target = event.currentTarget
    try {
      target.setPointerCapture(event.pointerId)
    } catch {
      /* 合成事件可能没有 pointerId */
    }

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY
      if (Math.abs(dx) + Math.abs(dy) > 3) movedRef.current = true
      setPos(clampPos({ right: start.right - dx, bottom: start.bottom - dy }))
    }
    const onUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDragging(false)
      const dx = upEvent.clientX - startX
      const dy = upEvent.clientY - startY
      if (movedRef.current) save(clampPos({ right: start.right - dx, bottom: start.bottom - dy }))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onClick = () => {
    // 拖动结束时不要顺带触发速览切换
    if (movedRef.current) {
      movedRef.current = false
      return
    }
    layout.togglePeek()
  }

  return h(
    'button',
    {
      className: 'dsv-peek-fab',
      'data-peek': state.peek ? 'true' : 'false',
      'data-dragging': dragging ? 'true' : 'false',
      style: { right: `${pos.right}px`, bottom: `${pos.bottom}px` },
      title: state.peek ? '返回 Code Space（Ctrl+Alt+Q）' : '速览 DSH（Ctrl+Alt+Q）· 可拖动',
      onPointerDown,
      onClick
    },
    state.peek ? '← 返回' : '对话'
  )
}
