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
import { Breadcrumbs } from './Breadcrumbs'

export function EditorView({ ctx }: { ctx?: { cwd?: string | null } }) {
  const snap = React.useSyncExternalStore(workspace.subscribe, workspace.getSnapshot)
  const activeTab = snap.tabs.find((tab) => tab.key === snap.active)
  const secondaryRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!snap.secondary) return
    const element = secondaryRef.current
    if (!element) return
    void workspace.attachSecondary(element)
    return () => workspace.detachSecondary()
  }, [snap.secondary?.key])

  return h(
    'div',
    { className: 'dsv-editor-view' },
    h(
      'div',
      { className: 'dsv-editor-columns' },
      h(
        'div',
        { className: 'dsv-editor-column' },
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
        activeTab && activeTab.kind === 'file'
          ? h(Breadcrumbs, { path: activeTab.path, cwd: ctx?.cwd ?? null })
          : null,
        h(EditorPane, null)
      ),
      snap.secondary
        ? h(
            'div',
            { className: 'dsv-split-column' },
            h(
              'div',
              { className: 'dsv-split-head' },
              h('span', { className: 'dsv-split-name', title: snap.secondary.path }, snap.secondary.name),
              h(
                'button',
                { className: 'dsv-mini-btn', title: '关闭分屏', onClick: () => workspace.closeSecondary() },
                '✕'
              )
            ),
            h(
              'div',
              { className: 'dsv-split-crumbs', title: snap.secondary.path },
              snap.secondary.path
                .split(/[\\/]/)
                .filter(Boolean)
                .slice(-4)
                .join(' › ')
            ),
            h('div', { ref: secondaryRef, className: 'dsv-split-editor' })
          )
        : null
    )
  )
}
