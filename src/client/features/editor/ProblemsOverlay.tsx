/**
 * 问题面板浮层：按文件分组列出当前打开文件的诊断。
 */

import * as React from 'react'

import { h } from '../../h'
import { registry } from '../../kernel/registry'
import { problemsPanel, problemsStore, type Problem } from './problems'

const ICON: Record<Problem['severity'], string> = {
  error: '✖',
  warning: '▲',
  info: 'ℹ',
  hint: '·'
}

export function ProblemsOverlay() {
  const open = React.useSyncExternalStore(problemsPanel.subscribe, problemsPanel.getSnapshot)
  const items = React.useSyncExternalStore(problemsStore.subscribe, problemsStore.getSnapshot)

  React.useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') problemsPanel.close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const groups = new Map<string, { name: string; list: Problem[] }>()
  for (const item of items) {
    const group = groups.get(item.path) ?? { name: item.name, list: [] }
    group.list.push(item)
    groups.set(item.path, group)
  }
  const errors = items.filter((item) => item.severity === 'error').length
  const warnings = items.filter((item) => item.severity === 'warning').length

  return h(
    'div',
    { className: 'dsv-problems', onPointerDown: (event: React.PointerEvent) => event.stopPropagation() },
    h(
      'div',
      { className: 'dsv-problems-head' },
      h('span', { className: 'dsv-problems-title' }, '问题'),
      h('span', { className: 'dsv-problems-count', 'data-kind': 'error' }, `✖ ${errors}`),
      h('span', { className: 'dsv-problems-count', 'data-kind': 'warning' }, `▲ ${warnings}`),
      h('span', { style: { flex: 1 } }),
      h('button', { className: 'dsv-mini-btn', title: '关闭（Esc）', onClick: () => problemsPanel.close() }, '✕')
    ),
    h(
      'div',
      { className: 'dsv-problems-body' },
      items.length === 0
        ? h('div', { className: 'dsv-problems-empty' }, '当前没有检测到问题（只统计已打开文件）。')
        : [...groups.entries()].map(([path, group]) =>
            h(
              React.Fragment,
              { key: path },
              h('div', { className: 'dsv-problems-file', title: path }, group.name),
              group.list.map((item, index) =>
                h(
                  'div',
                  {
                    key: `${path}:${item.line}:${item.column}:${index}`,
                    className: 'dsv-problems-row',
                    'data-severity': item.severity,
                    title: item.message,
                    onClick: () => {
                      problemsPanel.close()
                      registry.openFile(path, { line: item.line })
                    }
                  },
                  h('span', { className: 'dsv-problems-icon', 'data-severity': item.severity }, ICON[item.severity]),
                  h('span', { className: 'dsv-problems-message' }, item.message),
                  h('span', { className: 'dsv-problems-pos' }, `${item.line}:${item.column}`)
                )
              )
            )
          )
    )
  )
}
