/**
 * 左侧栏入口（DSH `sidebar.panellist` 插槽）。
 *
 * 只有一个按钮：Code Space —— 点击开/关工作台（toggle）。
 *
 * 做成 toggle 的原因：窗口被拖到屏幕外或叠在别的浮层后面时，右上角的 ✕
 * 可能点不到；入口永远在侧栏里，再点一次就能关掉。
 * 打开时会顺手 reflow 一次，把保存下来但已不在视口内的几何夹回可见区域。
 */

import * as React from 'react'

import { h } from '../h'
import { layout } from '../kernel/layout'
import { SHORT_NAME } from './brand'

export function Launcher() {
  const state = React.useSyncExternalStore(layout.subscribe, layout.getSnapshot)

  const toggle = () => {
    if (layout.getSnapshot().open) {
      layout.close()
      return
    }
    layout.open()
    // 几何可能是在别的分辨率下保存的：打开时夹回当前视口
    layout.reflow()
  }

  return h(
    'div',
    { className: 'dsv-launcher', 'data-dsv-slot': 'launcher' },
    h(
      'button',
      {
        className: 'dsv-open-btn',
        'data-primary': 'true',
        'data-open': state.open ? 'true' : 'false',
        title: state.open ? '关闭工作台（Ctrl+Alt+I）' : '打开工作台（Ctrl+Alt+I）',
        onClick: toggle
      },
      SHORT_NAME
    )
  )
}
