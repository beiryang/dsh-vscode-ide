/**
 * 编辑器 feature 的注册入口：主区视图、打开文件 / 打开 diff 的服务实现、
 * 文档状态汇报、主题与布局联动。
 */

import * as React from 'react'

import { h } from '../../h'
import { layout } from '../../kernel/layout'
import { prefs } from '../../kernel/prefs'
import { registry } from '../../kernel/registry'
import { registerEditorCommands } from './commands'
import { CSS } from './styles'
import { EditorView } from './EditorView'
import { monacoProbe } from './probe'
import { workspace } from './monaco/workspace'

function TabsStatus() {
  const snap = React.useSyncExternalStore(workspace.subscribe, workspace.getSnapshot)
  if (snap.tabs.length === 0) return null
  return h('span', null, `${snap.tabs.length} 个标签`)
}

export function registerEditorFeature(): () => void {
  const disposers: Array<() => void> = []

  disposers.push(registry.addStyles(CSS))
  disposers.push(registerEditorCommands())

  disposers.push(
    registry.registerView({
      apiVersion: 1,
      id: 'editor',
      title: '编辑器',
      region: 'main',
      order: 10,
      component: EditorView
    })
  )

  registry.setFileOpener((path, options) => {
    void workspace.openPath(path, options?.name).then(() => {
      if (options?.line) workspace.revealLine(options.line)
    })
  })
  registry.setDiffOpener((left, right) => {
    void workspace.openDiff(left, right)
  })

  const syncDocument = () => {
    const snap = workspace.getSnapshot()
    const active = snap.tabs.find((tab) => tab.key === snap.active)
    registry.setDocumentState({
      activePath: active?.path ?? null,
      dirtyCount: snap.tabs.filter((tab) => tab.dirty).length,
      tabCount: snap.tabs.length
    })
  }
  disposers.push(workspace.subscribe(syncDocument))
  syncDocument()

  const relayout = () => workspace.relayout()
  window.addEventListener('resize', relayout)
  disposers.push(() => window.removeEventListener('resize', relayout))
  disposers.push(layout.subscribe(relayout))

  // 从速览回来：窗口重新可见后补布局 + 抢回编辑器焦点
  const onResumed = () => workspace.resume()
  window.addEventListener('dsv:resumed', onResumed)
  disposers.push(() => window.removeEventListener('dsv:resumed', onResumed))

  disposers.push(registry.subscribeTheme(() => workspace.syncTheme()))

  // 设置里改编辑器字体时，已打开的编辑器就地更新
  disposers.push(prefs.subscribe(() => workspace.syncFont()))

  disposers.push(registry.registerProbe('monaco', monacoProbe))

  disposers.push(
    registry.registerStatusItem({
      apiVersion: 1,
      id: 'editor.tabs',
      order: 10,
      render: () => h(TabsStatus, null)
    })
  )

  // 恢复上次打开的标签（含未保存草稿）：窗口真正打开的那一刻才恢复
  let restored = false
  const tryRestore = () => {
    if (restored || !layout.getSnapshot().open) return
    restored = true
    void workspace.restoreTabs()
  }
  disposers.push(layout.subscribe(tryRestore))
  tryRestore()

  return () => {
    for (const dispose of disposers) {
      try {
        dispose()
      } catch {
        /* ignore */
      }
    }
  }
}
