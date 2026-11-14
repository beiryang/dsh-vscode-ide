/**
 * 入口（两处，位置可在设置里选）。
 *
 *   - 左侧栏 `sidebar.panellist`：和 DSH 自己的导航行一样，图标 + 文字，
 *     不再是整块蓝色按钮（issue #3：太扎眼）
 *   - 会话顶部 `conversation.session.header.actions`：标题右侧那一排小胶囊
 *
 * 两处都是 toggle：窗口被拖到屏幕外或叠在别的浮层后面时，再点一次就能关掉。
 * 打开时顺手 reflow 一次，把保存下来但已不在视口内的几何夹回可见区域。
 */

import * as React from 'react'

import { h } from '../h'
import { layout } from '../kernel/layout'
import { prefs } from '../kernel/prefs'
import { SHORT_NAME } from './brand'

function toggleWorkbench() {
  if (layout.getSnapshot().open) {
    layout.close()
    return
  }
  layout.open()
  // 几何可能是在别的分辨率下保存的：打开时夹回当前视口
  layout.reflow()
}

function title(open: boolean): string {
  return open ? '关闭 Code Space（Ctrl+Alt+I）' : '打开 Code Space（Ctrl+Alt+I）'
}

/** 16px 线条图标：左侧栏 + 编辑区，和 DSH 自带导航图标同一视觉重量 */
const ICON = h(
  'svg',
  {
    className: 'dsv-nav-glyph',
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round',
    'aria-hidden': 'true'
  },
  h('rect', { x: 2, y: 3, width: 12, height: 10, rx: 2 }),
  h('path', { d: 'M6.2 3.2v9.6' })
)

export function Launcher() {
  const state = React.useSyncExternalStore(layout.subscribe, layout.getSnapshot)
  const { entryPlacement: placement, entryStyle: style } = React.useSyncExternalStore(
    prefs.subscribe,
    prefs.getSnapshot
  )

  if (placement === 'header' || placement === 'none') return null

  const entry =
    style === 'button'
      ? h(
          'button',
          {
            className: 'dsv-open-btn',
            'data-primary': 'true',
            'data-open': state.open ? 'true' : 'false',
            title: title(state.open),
            onClick: toggleWorkbench
          },
          SHORT_NAME
        )
      : h(
          'button',
          {
            className: 'dsv-nav-entry',
            'data-open': state.open ? 'true' : 'false',
            title: title(state.open),
            onClick: toggleWorkbench
          },
          ICON,
          h('span', { className: 'dsv-nav-text' }, SHORT_NAME)
        )

  return h('div', { className: 'dsv-launcher', 'data-style': style, 'data-dsv-slot': 'launcher' }, entry)
}

/** 会话顶部那一排（对话/轨迹 右侧、和「标准模式」同排）的小入口 */
export function HeaderEntry() {
  const state = React.useSyncExternalStore(layout.subscribe, layout.getSnapshot)
  const placement = React.useSyncExternalStore(prefs.subscribe, prefs.getSnapshot).entryPlacement

  if (placement === 'sidebar' || placement === 'none') return null

  return h(
    'button',
    {
      className: 'dsv-header-entry',
      'data-open': state.open ? 'true' : 'false',
      title: title(state.open),
      onClick: toggleWorkbench
    },
    ICON,
    h('span', { className: 'dsv-header-entry-text' }, SHORT_NAME)
  )
}
