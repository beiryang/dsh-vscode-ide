/**
 * 侧栏容器：左侧竖向图标栏（类 VS Code 活动栏）+ 右侧内容区。
 */

import * as React from 'react'

import { h } from '../../h'
import { ErrorBoundary } from '../ErrorBoundary'
import { registry, type ViewContribution, type WorkbenchContext } from '../registry'
import { sidebar } from '../sidebar'

function svg(children: React.ReactNode) {
  return h('svg', { className: 'dsv-activity-svg', viewBox: '0 0 16 16', 'aria-hidden': 'true' }, children)
}

function ActivityIcon({ name }: { name: string }) {
  if (name === 'search') {
    return svg([
      h('circle', { key: 'c', cx: 7, cy: 7, r: 4.2, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3 }),
      h('path', { key: 'l', d: 'M10.2 10.2 14 14', stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linecap': 'round' })
    ])
  }
  if (name === 'explorer') {
    return svg([
      h('path', { key: 'a', d: 'M4 2.5h4.5L12 6v7.5H4z', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }),
      h('path', { key: 'b', d: 'M8.5 2.5V6H12', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2 })
    ])
  }
  if (name === 'globe') {
    return svg([
      h('circle', { key: 'a', cx: 8, cy: 8, r: 5.4, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2 }),
      h('path', { key: 'b', d: 'M2.6 8h10.8', stroke: 'currentColor', 'stroke-width': 1.1 }),
      h('path', { key: 'c', d: 'M8 2.6c1.8 1.6 2.6 3.4 2.6 5.4S9.8 11.8 8 13.4C6.2 11.8 5.4 10 5.4 8S6.2 4.2 8 2.6z', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.1 })
    ])
  }
  if (name === 'git') {
    return svg([
      h('circle', { key: 'a', cx: 5, cy: 3.3, r: 1.6, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2 }),
      h('circle', { key: 'b', cx: 5, cy: 12.7, r: 1.6, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2 }),
      h('circle', { key: 'c', cx: 11, cy: 6, r: 1.6, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2 }),
      h('path', { key: 'd', d: 'M5 4.9v6.2', stroke: 'currentColor', 'stroke-width': 1.2 }),
      h('path', { key: 'e', d: 'M11 7.6c0 3-6 3.1-6 3.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2 })
    ])
  }
  return h('span', { className: 'dsv-activity-icon' }, name)
}

function iconNameOf(view: ViewContribution): string {
  if (view.id === 'explorer') return 'explorer'
  if (view.id === 'git') return 'git'
  return view.icon ?? view.title.trim().slice(0, 1)
}

export function SidebarHost({ ctx, width }: { ctx: WorkbenchContext; width?: number }) {
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
    {
      className: 'dsv-sidebar',
      style: width ? { width: `${width}px`, minWidth: '200px', maxWidth: '70%' } : undefined
    },
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
          h(ActivityIcon, { name: iconNameOf(view) })
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
      active ? h(ErrorBoundary, { key: active.id, label: active.title }, h(active.component, { ctx })) : null
    )
  )
}
