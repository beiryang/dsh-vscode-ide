/**
 * 终端面板：底部停靠区，支持多个 SSH 会话、拖动上边缘改高度。
 */

import * as React from 'react'

import { h } from '../../h'
import { prefs } from '../../kernel/prefs'
import { quickConnect } from './connect'
import { sshDialog } from './sshTargets'
import { terminal } from './terminal'
import { TerminalView } from './TerminalView'
import { LocalConsole } from './LocalConsole'

export function TerminalPanel() {
  const snap = React.useSyncExternalStore(terminal.subscribe, terminal.getSnapshot)
  const prefsVersion = React.useSyncExternalStore(prefs.subscribe, () => prefs.version)
  void prefsVersion
  const dock = prefs.getSnapshot().panelDock
  const [busy, setBusy] = React.useState(false)
  const lastHeight = React.useRef(260)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const draggedRef = React.useRef(false)
  const collapsed = dock === 'bottom' && snap.height <= 48

  if (!snap.open) return null

  const create = () => {
    void quickConnect()
  }

  const createLocal = async () => {
    if (busy) return
    setBusy(true)
    try {
      await terminal.createLocal()
    } finally {
      setBusy(false)
    }
  }

  const beginResize = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const startHeight = snap.height
    const startWidth = snap.width
    draggedRef.current = false
    const onMove = (moveEvent: PointerEvent) => {
      if (Math.abs(moveEvent.clientY - startY) > 3 || Math.abs(moveEvent.clientX - startX) > 3) {
        draggedRef.current = true
      }
      if (dock === 'right') {
        terminal.setWidth(startWidth + (startX - moveEvent.clientX))
        return
      }
      // 上限取「编辑器列」的高度（不是终端自己的父容器，否则会把自己锁死）
      const column = rootRef.current?.closest('.dsv-main') as HTMLElement | null
      const columnHeight = column?.clientHeight ?? window.innerHeight
      const next = Math.min(startHeight + (startY - moveEvent.clientY), columnHeight - 4)
      terminal.setHeight(next)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (dock !== 'bottom') return
      const next = terminal.getSnapshot().height
      if (next < 44) {
        // 拖到几乎贴底才吸附成一条线；稍微拖起来就保持当前高度，不再弹回去
        terminal.setHeight(10)
      } else {
        lastHeight.current = next
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const active = snap.sessions.find((item) => item.id === snap.activeId) ?? snap.sessions[snap.sessions.length - 1]

  return h(
    'div',
    {
      ref: rootRef,
      className: 'dsv-term',
      'data-dock': dock,
      'data-collapsed': collapsed ? 'true' : 'false',
      style: dock === 'right' ? { width: `${snap.width}px`, height: '100%' } : { height: `${snap.height}px` }
    },
    h('div', {
      className: 'dsv-term-resize',
      'data-collapsed': collapsed ? 'true' : 'false',
      onPointerDown: beginResize,
      onClick: () => {
        if (!collapsed || draggedRef.current) return
        terminal.setHeight(Math.max(lastHeight.current, 240))
      },
      onDoubleClick: () => {
        if (dock !== 'bottom') return
        const current = terminal.getSnapshot().height
        if (current > 100) {
          lastHeight.current = current
          terminal.setHeight(10)
        } else {
          terminal.setHeight(Math.max(lastHeight.current, 240))
        }
      },
      title: collapsed
        ? '点击或向上拖动展开终端'
        : dock === 'right'
          ? '拖动调整宽度'
          : '拖动调整高度'
    }),
    h(
      'div',
      { className: 'dsv-term-head' },
      h(
        'div',
        { className: 'dsv-term-tabs' },
        snap.sessions.map((session) =>
          h(
            'div',
            {
              key: session.id,
              className: 'dsv-term-tab',
              'data-active': session.id === active?.id ? 'true' : 'false',
              'data-status': session.status,
              onClick: () => terminal.setActive(session.id),
              title: session.message || session.label
            },
            h('span', { className: 'dsv-term-tab-name' }, session.label),
            h(
              'button',
              {
                className: 'dsv-term-tab-close',
                title: '关闭终端',
                onClick: (event: React.MouseEvent) => {
                  event.stopPropagation()
                  void terminal.closeSession(session.id)
                }
              },
              '✕'
            )
          )
        )
      ),
      h('span', { style: { flex: 1 } }),
      h('button', { className: 'dsv-mini-btn', title: '连接 SSH（已记住唯一主机时直接连）', onClick: () => create() }, busy ? '…' : '＋SSH'),
      h('button', { className: 'dsv-mini-btn', title: '选择或新建 SSH 连接', onClick: () => sshDialog.open() }, '▾'),
      h('button', { className: 'dsv-mini-btn', title: '本地 PowerShell（非 PTY）', onClick: () => void createLocal() }, busy ? '…' : '＋本地'),
      h(
        'button',
        {
          className: 'dsv-mini-btn',
          title: dock === 'right' ? '停靠到下方' : '停靠到右侧（占满高度）',
          onClick: () => prefs.setPanelDock(dock === 'right' ? 'bottom' : 'right')
        },
        dock === 'right' ? '⇩' : '⇨'
      ),
      h('button', { className: 'dsv-mini-btn', title: '收起终端面板', onClick: () => terminal.close() }, '▾')
    ),
    h(
      'div',
      { className: 'dsv-term-body' },
      snap.sessions.length === 0
        ? h(
            'div',
            { className: 'dsv-term-empty' },
            '还没有终端。右上角「＋SSH」连接远程主机（手填主机/用户/私钥），「＋本地」开本地 PowerShell（非 PTY）。'
          )
        : snap.sessions.map((session) =>
            session.status === 'ready' && session.kind === 'local'
              ? h(LocalConsole, { key: session.id, session, active: session.id === active?.id })
              : session.status === 'ready'
                ? h(TerminalView, { key: session.id, session, active: session.id === active?.id })
                : h(
                  'div',
                  {
                    key: session.id,
                    className: 'dsv-term-view',
                    'data-active': session.id === active?.id ? 'true' : 'false'
                  },
                  h(
                    'div',
                    { className: 'dsv-term-empty' },
                    session.status === 'connecting'
                      ? '正在连接 SSH…'
                      : session.status === 'error'
                        ? `连接失败：${session.message || '未知错误'}`
                        : '会话已结束，点右上角 ＋ 新建一个终端。'
                  )
                )
          )
    )
  )
}
