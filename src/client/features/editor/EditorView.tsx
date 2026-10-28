/**
 * 编辑器主区视图：标签条 + Monaco。
 *
 * 内核只负责把这块区域放在窗口里，标签管理/比较按钮都是编辑器自己的事。
 */

import * as React from 'react'

import { h } from '../../h'
import { TabBar } from './TabBar'
import { EditorPane } from './EditorPane'
import { workspace } from './monaco/workspace'

export function EditorView() {
  const snap = React.useSyncExternalStore(workspace.subscribe, workspace.getSnapshot)
  const activeTab = snap.tabs.find((tab) => tab.key === snap.active)

  return h(
    'div',
    { className: 'dsv-editor-view' },
    h(
      'div',
      { className: 'dsv-editor-toolbar' },
      h(TabBar, { tabs: snap.tabs, active: snap.active }),
      activeTab && activeTab.kind === 'file'
        ? h(
            'button',
            {
              className: 'dsv-mini-btn',
              title: '与磁盘版本比较（未保存的内容 ⇄ 磁盘）',
              onClick: () => void workspace.compareWithDisk()
            },
            '⇄'
          )
        : null
    ),
    h(EditorPane, null)
  )
}
