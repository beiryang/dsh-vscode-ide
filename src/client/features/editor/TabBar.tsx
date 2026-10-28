/**
 * 编辑器区的标签条：文件名 + 脏标记 + 关闭按钮。
 * 拖拽排序放 Phase 2，这里先把「多标签 + 未保存」跑通。
 */

import * as React from 'react'

import { h } from '../../h'
import { workspace, type WorkspaceTab } from './monaco/workspace'

function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function TabBar({ tabs, active }: { tabs: WorkspaceTab[]; active: string | null }) {
  if (tabs.length === 0) {
    return h('div', { className: 'dsv-tabbar' }, h('span', { className: 'dsv-tabbar-name' }, '欢迎'))
  }

  const current = tabs.find((tab) => tab.key === active)

  return h(
    'div',
    { className: 'dsv-tabbar dsv-tabbar-tabs' },
    h(
      'div',
      { className: 'dsv-tabs' },
      tabs.map((tab) =>
        h(
          'div',
          {
            key: tab.key,
            className: 'dsv-tab',
            'data-active': tab.key === active ? 'true' : 'false',
            title: tab.path,
            onClick: () => workspace.activate(tab.key),
            onAuxClick: (event: React.MouseEvent) => {
              if (event.button === 1) workspace.close(tab.key)
            }
          },
          h('span', { className: 'dsv-tab-dot', 'data-dirty': tab.dirty ? 'true' : 'false' }),
          h('span', { className: 'dsv-tab-name' }, tab.name),
          tab.readOnly ? h('span', { className: 'dsv-tab-tag' }, '只读') : null,
          h(
            'button',
            {
              className: 'dsv-tab-close',
              title: '关闭',
              onClick: (event: React.MouseEvent) => {
                event.stopPropagation()
                workspace.close(tab.key)
              }
            },
            '✕'
          )
        )
      )
    ),
    current
      ? h(
          'div',
          { className: 'dsv-tab-meta' },
          current.dirty ? h('span', { className: 'dsv-tab-dirty' }, '未保存') : null,
          h('span', null, sizeText(current.size))
        )
      : null
  )
}
