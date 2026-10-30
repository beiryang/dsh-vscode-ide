/**
 * 终端面板：底部停靠区，支持多个 SSH 会话、拖动上边缘改高度。
 */

import * as React from 'react'

import { h } from '../../h'
import { api } from '../../kernel/transport'
import { prefs } from '../../kernel/prefs'
import { sessionStore } from '../../kernel/session'
import { quickConnect } from './connect'
import { sshDialog } from './sshTargets'
import { terminal } from './terminal'
import { TerminalView, termRegistry } from './TerminalView'

export function TerminalPanel({ ctx }: { ctx?: { remote?: boolean; cwd?: string | null; sessionId?: string } }) {
  const snap = React.useSyncExternalStore(terminal.subscribe, terminal.getSnapshot)
  const prefsVersion = React.useSyncExternalStore(prefs.subscribe, () => prefs.version)
  void prefsVersion
  const dock = prefs.getSnapshot().panelDock
  const [busy, setBusy] = React.useState(false)
  const [bannerDismissed, setBannerDismissed] = React.useState<Set<string>>(new Set())
  const [workspaceRemote, setWorkspaceRemote] = React.useState<boolean | null>(null)
  const [workspaceCwd, setWorkspaceCwd] = React.useState<string | null>(ctx?.cwd ?? null)
  // 会话 key 由内核每秒同步；用它做依赖，切工作区（不关窗口）也能重新探测
  const liveSession = React.useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot)

  React.useEffect(() => {
    let alive = true
    void api
      .roots()
      .then((info) => {
        if (!alive) return
        setWorkspaceRemote(info.remote === true)
        setWorkspaceCwd(info.cwd)
      })
      .catch(() => {
        if (alive) setWorkspaceRemote(false)
      })
    return () => {
      alive = false
    }
  }, [liveSession])
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null)
  const [renameFor, setRenameFor] = React.useState<{ id: string; value: string } | null>(null)
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

  React.useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [menu])

  const termOf = (id: string | undefined) => (id ? termRegistry.get(id) : undefined)

  const copySelection = () => {
    const text = termOf(active?.id)?.getSelection?.() ?? ''
    if (text) void navigator.clipboard?.writeText(text).catch(() => undefined)
  }

  const paste = async () => {
    if (!active) return
    try {
      const text = await navigator.clipboard.readText()
      if (text) await api.termWrite(active.id, text)
    } catch {
      /* 没有剪贴板权限时忽略 */
    }
  }

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
              title:
                session.kind === 'ssh'
                  ? `${session.label} · 远程 shell（当前工作区仍是本地）`
                  : session.message || session.label
            },
            h('span', { className: 'dsv-term-tab-name' }, session.label),
            session.kind === 'ssh' ? h('span', { className: 'dsv-term-tab-remote' }, '远程') : null,
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
      h('button', { className: 'dsv-mini-btn', title: '本地 PowerShell（PTY）', onClick: () => void createLocal() }, busy ? '…' : '＋本地'),
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
    active && active.kind === 'ssh' && workspaceRemote === false && !bannerDismissed.has(active.id)
      ? h(
          'div',
          { className: 'dsv-term-banner' },
          h(
            'span',
            { className: 'dsv-term-banner-text' },
            `此终端运行在 ${active.label} 上；当前工作区仍是本地${workspaceCwd ? `（${workspaceCwd}）` : ''}，命令只在远端生效。`
          ),
          h(
            'button',
            {
              className: 'dsv-mini-btn',
              onClick: () => setBannerDismissed((previous) => new Set(previous).add(active.id))
            },
            '知道了'
          )
        )
      : null,
    h(
      'div',
      {
        className: 'dsv-term-body',
        onContextMenu: (event: React.MouseEvent) => {
          // 以鼠标下的终端为准（多标签时右键非活动标签也能操作它）
          const holder = (event.target as HTMLElement | null)?.closest('[data-session]')
          const id = holder?.getAttribute('data-session') ?? active?.id
          if (!id) return
          event.preventDefault()
          terminal.setActive(id)
          setMenu({ x: event.clientX, y: event.clientY })
        }
      },
      snap.sessions.length === 0
        ? h(
            'div',
            { className: 'dsv-term-empty' },
            '还没有终端。右上角「＋SSH」连接远程主机（手填主机/用户/私钥），「＋本地」开本地 PowerShell（真 PTY）。'
          )
        : snap.sessions.map((session) =>
            session.status === 'ready'
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
    ,
    menu
      ? h(
          'div',
          {
            className: 'dsv-term-menu',
            style: { left: `${menu.x}px`, top: `${menu.y}px` },
            onPointerDown: (event: React.PointerEvent) => event.stopPropagation()
          },
          h(
            'button',
            { className: 'dsv-term-menu-item', disabled: !termOf(active?.id)?.getSelection?.(), onClick: () => { copySelection(); setMenu(null) } },
            '复制（选中内容）'
          ),
          h('button', { className: 'dsv-term-menu-item', onClick: () => { void paste(); setMenu(null) } }, '粘贴'),
          h(
            'button',
            {
              className: 'dsv-term-menu-item',
              onClick: () => {
                termOf(active?.id)?.selectAll?.()
                setMenu(null)
              }
            },
            '全选'
          ),
          h(
            'button',
            {
              className: 'dsv-term-menu-item',
              onClick: () => {
                // 发 Ctrl+L 给 shell：清掉当前屏幕，和终端里按 Ctrl+L 一致
                if (active) void api.termWrite(active.id, '\u000c')
                setMenu(null)
              }
            },
            '清屏'
          ),
          h(
            'button',
            {
              className: 'dsv-term-menu-item',
              onClick: () => {
                if (active) setRenameFor({ id: active.id, value: active.label })
                setMenu(null)
              }
            },
            '重命名会话…'
          ),
          h(
            'button',
            {
              className: 'dsv-term-menu-item',
              'data-danger': 'true',
              onClick: () => {
                if (active) void terminal.closeSession(active.id)
                setMenu(null)
              }
            },
            '关闭终端'
          )
        )
      : null,
    renameFor
      ? h(
          'div',
          { className: 'dsv-term-dialog-backdrop', onPointerDown: () => setRenameFor(null) },
          h(
            'div',
            { className: 'dsv-term-dialog', onPointerDown: (event: React.PointerEvent) => event.stopPropagation() },
            h('div', { className: 'dsv-term-dialog-title' }, '重命名终端'),
            h('input', {
              className: 'dsv-term-dialog-input',
              value: renameFor.value,
              autoFocus: true,
              onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                setRenameFor({ ...renameFor, value: (event.target as HTMLInputElement).value }),
              onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key === 'Escape') setRenameFor(null)
                if (event.key === 'Enter') {
                  terminal.rename(renameFor.id, renameFor.value)
                  setRenameFor(null)
                }
              }
            }),
            h(
              'div',
              { className: 'dsv-term-dialog-actions' },
              h('button', { className: 'dsv-term-dialog-btn', onClick: () => setRenameFor(null) }, '取消'),
              h(
                'button',
                {
                  className: 'dsv-term-dialog-btn',
                  'data-primary': 'true',
                  onClick: () => {
                    terminal.rename(renameFor.id, renameFor.value)
                    setRenameFor(null)
                  }
                },
                '保存'
              )
            )
          )
        )
      : null
  )
}
