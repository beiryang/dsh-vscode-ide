/**
 * 侧栏容器：按注册表渲染「资源管理器 / 源代码管理 …」这些页签。
 *
 * 内核不知道每个页签里是什么，只知道 id/title/component；
 * 当前选中的页签存在 kernel/sidebar.ts，别的模块可以让它切过去。
 *
 * 带 hidden 的视图（比如设置）不占页签位置，被激活时顶部出现一条
 * 「标题 + 返回」的窄条，返回时回到第一个可见页签。
 */

import * as React from 'react'

import { h } from '../../h'
import { registry, type ViewContribution, type WorkbenchContext } from '../registry'
import { sidebar } from '../sidebar'

export function SidebarHost({ ctx }: { ctx: WorkbenchContext }) {
  React.useSyncExternalStore(registry.subscribeViews, registry.getViewVersion)
  const activeId = React.useSyncExternalStore(sidebar.subscribe, sidebar.getSnapshot)
  const views = registry.getViews('sidebar')
  const visible = views.filter((view) => !view.hidden)

  const active = views.find((item) => item.id === activeId) ?? visible[0] ?? views[0]

  if (views.length === 0) {
    return h('div', { className: 'dsv-sidebar' }, h('div', { className: 'dsv-tree-note' }, '没有注册侧栏视图'))
  }

  const back = () => sidebar.setActive(visible[0]?.id ?? '')

  return h(
    'div',
    { className: 'dsv-sidebar' },
    active?.hidden
      ? h(
          'div',
          { className: 'dsv-sidebar-floating-head' },
          h('button', { className: 'dsv-mini-btn', title: '返回', onClick: back }, '←'),
          h('span', { className: 'dsv-sidebar-floating-title' }, active.title)
        )
      : h(
          'div',
          { className: 'dsv-sidebar-tabs' },
          visible.map((view: ViewContribution) =>
            h(
              'button',
              {
                key: view.id,
                className: 'dsv-sidebar-tab',
                'data-active': view.id === active?.id ? 'true' : 'false',
                onClick: () => sidebar.setActive(view.id)
              },
              view.title
            )
          )
        ),
    active ? h(active.component, { key: active.id, ctx }) : null
  )
}
