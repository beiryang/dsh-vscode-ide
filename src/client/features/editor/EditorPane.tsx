/**
 * 编辑器容器：负责把 Monaco 挂到 DOM 上（模型与标签状态在 workspace 里）。
 *
 * 两个容器：普通编辑器与对比编辑器。哪个显示由当前标签的 kind 决定，
 * 两者都常驻，避免来回创建/销毁。右侧分屏由 EditorView 单独放一列。
 */

import * as React from 'react'

import { h } from '../../h'
import { workspace } from './monaco/workspace'

function Welcome({ loading }: { loading: boolean }) {
  return h(
    'div',
    { className: 'dsv-placeholder dsv-placeholder-overlay' },
    h('strong', null, loading ? '正在加载 Monaco…' : '还没有打开文件'),
    h('div', null, '在左侧文件树点一个文件；Ctrl+S 保存，Ctrl+W 关标签。'),
    h('div', { className: 'dsv-hint' }, '已打开的标签会保留未保存内容，切走再回来不会丢。')
  )
}

export function EditorPane() {
  const snap = React.useSyncExternalStore(workspace.subscribe, workspace.getSnapshot)
  const editorRef = React.useRef<HTMLDivElement | null>(null)
  const diffRef = React.useRef<HTMLDivElement | null>(null)

  const activeTab = snap.tabs.find((tab) => tab.key === snap.active)
  const isDiff = activeTab?.kind === 'diff'
  const empty = snap.tabs.length === 0

  React.useEffect(() => {
    const element = editorRef.current
    if (!element) return
    void workspace.attach(element)
    return () => workspace.detach()
  }, [])

  React.useEffect(() => {
    const element = diffRef.current
    if (!element) return
    void workspace.attachDiff(element)
    return () => workspace.detachDiff()
  }, [])

  React.useEffect(() => {
    // 切标签 / 窗口尺寸变化后补一次布局，避免光标位置与可见区域错位
    workspace.relayout()
  }, [snap.active])

  return h(
    'div',
    { className: 'dsv-editor-zone', 'data-mode': isDiff ? 'diff' : 'edit' },
    h(
      'div',
      { className: 'dsv-editor-primary' },
      h('div', {
        ref: editorRef,
        className: 'dsv-editor',
        'data-empty': empty ? 'true' : 'false',
        style: isDiff ? { display: 'none' } : undefined
      }),
      h('div', { ref: diffRef, className: 'dsv-diff', style: isDiff ? undefined : { display: 'none' } }),
      empty ? h(Welcome, { loading: snap.status.phase === 'loading' }) : null,
      snap.status.message && snap.status.phase !== 'ready'
        ? h(
            'div',
            {
              className: 'dsv-editor-toast',
              'data-kind': snap.status.phase,
              style: snap.status.phase === 'error' ? { cursor: 'pointer' } : undefined,
              onClick: snap.status.phase === 'error' ? () => workspace.retry() : undefined
            },
            snap.status.message
          )
        : null
    )
  )
}
