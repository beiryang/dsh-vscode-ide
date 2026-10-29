/**
 * 侧栏容器：左侧竖向图标栏（类 VS Code 活动栏）+ 右侧内容区。
 *
 * 内核仍然只知道 id/title/icon/component；图标缺失时用标题首字兜底。
 * hidden 视图（比如设置）不占图标栏位置，激活时顶部出现「返回 + 标题」。
 */

import * as React from 'react'

import { h } from '../../h'
import { registry, type ViewContribution, type WorkbenchContext } from '../registry'
import { sidebar } from '../sidebar'

function iconOf(view: ViewContribution): string {
  if (view.icon) return view.icon
  const title = view.title.trim()
  return title ? title.slice(0, 1) : '·'
}

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
    /* 竖向图标栏 */
    h(
      'div',
      { className: 'dsv-activitybar' },
      visible.map((view: ViewContribution) =>
        h(
          'button',
          {
            key: view.id,
            className: 'dsv-activity-btn',
            'data-active': view.id === active?.id ? 'true' : 'false',
            title: view.title,
            onClick: () => sidebar.setActive(view.id)
          },
          h('span', { className: 'dsv-activity-icon' }, iconOf(view))
        )
      )
    ),
    /* 内容区 */
    h(
      'div',
      { className: 'dsv-sidebar-content' },
      active?.hidden
        ? h(
            'div',
            { className: 'dsv-sidebar-floating-head' },
            h('button', { className: 'dsv-mini-btn', title: '返回', onClick: back }, '←'),
            h('span', { className: 'dsv-sidebar-floating-title' }, active.title)
          )
        : null,
      active ? h(active.component, { key: active.id, ctx }) : null
    )
  )
}
