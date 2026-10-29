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

function ActivityIcon({ name }: { name: string }) {
  const paths: Record<string, string[]> = {
    explorer: ['M4 2h5l3 3v9H4z', 'M9 2v3h3'],
    git: ['M5 5.2v5.6', 'M11 7.2c0 2.6-6 2.8-6 3.6'],
    search: []
  }
  if (name === 'search') {
    return h('svg', { width: 22, height: 22, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
      h('circle', { cx: 7, cy: 7, r: 4.2, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3 }),
      h('path', { d: 'M10.2 10.2 14 14', stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linecap': 'round' })
    )
  }
  if (name === 'explorer') {
    return h('svg', { width: 22, height: 22, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
      ...paths.explorer.map((d, i) => h('path', { key: i, d, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2, 'stroke-linejoin': 'round' })
      )
  }
  if (name === 'git') {
    return h('svg', { width: 22, height: 22, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
      h('circle', { cx: 5, cy: 3.2, r: 1.6, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2 }),
      h('circle', { cx: 5, cy: 12.8, r: 1.6, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2 }),
      h('circle', { cx: 11, cy: 6, r: 1.6, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2 }),
      h('path', { d: 'M5 4.8v6.4', stroke: 'currentColor', 'stroke-width': 1.2 }),
      h('path', { d: 'M11 7.6c0 3-6 3.1-6 3.6', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2 })
    )
  }
  return h('span', { className: 'dsv-activity-icon' }, name)
}

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
          h(ActivityIcon, { name: view.id === 'explorer' ? 'explorer' : view.id === 'git' ? 'git' : view.icon ?? view.title })
        )
      ),
      h(
        'button',
        {
          key: 'search',
          className: 'dsv-activity-btn dsv-activity-search',
          title: '搜索（Ctrl+Alt+Shift+F）',
          onClick: () => {
            const open = (window as unknown as { __dsvOpenSearch?: () => void }).__dsvOpenSearch
            if (open) open()
          }
        },
        h(ActivityIcon, { name: 'search' })
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
