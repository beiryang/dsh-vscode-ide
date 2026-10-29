/** 搜索浮层：面板 + 点击外部 / Esc 关闭。 */

import * as React from 'react'

import { h } from '../../h'
import type { WorkbenchContext } from '../../kernel/registry'
import { searchPanel } from './panel'
import { SearchView } from './SearchView'

export function SearchOverlay({ ctx }: { ctx: WorkbenchContext }) {
  const open = React.useSyncExternalStore(searchPanel.subscribe, searchPanel.getSnapshot)
  const rootRef = React.useRef<HTMLDivElement | null>(null)

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
      // 点在标题栏「搜」按钮上时由按钮自己 toggle，避免刚开就关
      searchPanel.close()
    }
    // 延迟挂载，避免打开那一下的同一个事件把面板关掉
    const timer = window.setTimeout(() => window.addEventListener('pointerdown', onPointerDown), 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  if (!open) return null

  return h(
    'div',
    { className: 'dsv-search-overlay', ref: rootRef, 'data-dsv-search-overlay': 'true' },
    h(SearchView, { ctx })
  )
}
