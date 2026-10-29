/**
 * 工作台窗口（内核）：标题栏 / [侧栏 | 主区] / 底部面板 / 状态栏。
 *
 * 这里**只认识注册表**：侧栏视图、主区视图、底部面板、状态项全部来自
 * registry。内核不 import 任何 feature，所以将来把 kernel 拆成独立包时，
 * 这个文件可以原样搬走。
 */

import * as React from 'react'

import { h } from '../../h'
import { WINDOW_TITLE } from '../brand'
import { layout, MIN_H, MIN_W, SAFE_TOP, type Rect } from '../layout'
import { palette } from '../palette'
import { prefs } from '../prefs'
import { api, health } from '../transport'
import { registry, type WorkbenchContext } from '../registry'
import { Palette } from '../ui/Palette'
import { SidebarHost } from './SidebarHost'

type Mode = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const HANDLES: Mode[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

function applyGesture(mode: Mode, rect: Rect, dx: number, dy: number): Rect {
  let { x, y, w, h } = rect
  if (mode === 'move') {
    x = rect.x + dx
    y = rect.y + dy
  } else {
    if (mode.includes('e')) w = rect.w + dx
    if (mode.includes('s')) h = rect.h + dy
    if (mode.includes('w')) {
      w = rect.w - dx
      x = rect.x + dx
    }
    if (mode.includes('n')) {
      h = rect.h - dy
      y = rect.y + dy
    }
    if (w < MIN_W) {
      if (mode.includes('w')) x = rect.x + rect.w - MIN_W
      w = MIN_W
    }
    if (h < MIN_H) {
      if (mode.includes('n')) y = rect.y + rect.h - MIN_H
      h = MIN_H
    }
  }
  return { x, y, w, h }
}

export function WorkbenchWindow({ sessionId }: { sessionId: string }) {
  const state = React.useSyncExternalStore(layout.subscribe, layout.getSnapshot)
  const document = React.useSyncExternalStore(registry.subscribeDocument, registry.getDocumentState)
  React.useSyncExternalStore(registry.subscribeViews, registry.getViewVersion)
  React.useSyncExternalStore(registry.subscribeStatus, registry.getStatusVersion)

  const [viewport, setViewport] = React.useState({ w: window.innerWidth, h: window.innerHeight })
  const [cwd, setCwd] = React.useState<string | null>(null)
  const [cwdError, setCwdError] = React.useState<string | null>(null)
  const [remote, setRemote] = React.useState(false)
  const [host, setHost] = React.useState<'unknown' | 'ok' | 'fail'>('unknown')

  React.useEffect(() => {
    const onResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight })
      layout.reflow()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const retryRef = React.useRef(0)

  const loadRoot = React.useCallback(async () => {
    try {
      const info = await api.roots()
      setCwd(info.cwd)
      setRemote(info.remote === true)
      setCwdError(null)
      retryRef.current = 0
    } catch (cause) {
      const error = cause as Error & { code?: string }
      setCwd(null)
      setCwdError(error.message)
      // 刚启动时宿主可能还没加载好这个会话：短暂重试几次，别让用户去点会话
      if (error.code === 'no-workspace' && retryRef.current < 6) {
        retryRef.current += 1
        window.setTimeout(() => void loadRoot(), 1200)
      }
    }
  }, [])

  React.useEffect(() => {
    if (!state.open) return
    void loadRoot()
  }, [loadRoot, sessionId, state.open])


  // 从速览回来：窗口重新可见后让编辑器恢复布局与焦点
  React.useEffect(() => {
    if (!state.open || state.peek) return
    window.dispatchEvent(new CustomEvent('dsv:resumed'))
  }, [state.open, state.peek])

  React.useEffect(() => {
    if (!state.open) return
    void health()
      .then((payload) => setHost(payload && payload.ok ? 'ok' : 'fail'))
      .catch(() => setHost('fail'))
  }, [state.open, sessionId])

  const beginGesture = React.useCallback((event: React.PointerEvent, mode: Mode) => {
    if (event.button !== 0) return
    if (layout.getSnapshot().max) return
    event.preventDefault()
    event.stopPropagation()

    const start = layout.getSnapshot().rect
    const startX = event.clientX
    const startY = event.clientY
    const target = event.currentTarget as HTMLElement
    try {
      target.setPointerCapture(event.pointerId)
    } catch {
      /* 合成事件可能没有 pointerId */
    }

    const onMove = (moveEvent: PointerEvent) => {
      layout.previewRect(applyGesture(mode, start, moveEvent.clientX - startX, moveEvent.clientY - startY))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      layout.commit()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  const ctx: WorkbenchContext = React.useMemo(
    () => ({
      sessionId,
      cwd,
      cwdError,
      remote,
      openFile: (path, options) => registry.openFile(path, options),
      closeWindow: () => layout.close(),
      refreshWorkspace: () => {
        void loadRoot()
      }
    }),
    [sessionId, cwd, cwdError, remote, loadRoot]
  )

  if (!state.open) return null

  // 最大化也只在安全带以下：顶部留出 DSH 标题栏与系统窗口按钮，保证永远退得出来
  const rect = state.max
    ? { x: 0, y: SAFE_TOP, w: viewport.w, h: Math.max(MIN_H, viewport.h - SAFE_TOP) }
    : state.rect
  const [sidebarWidth, setSidebarWidth] = React.useState(() => {
    try {
      const raw = localStorage.getItem('dsv:sidebar.width.v1')
      const value = raw ? Number(raw) : NaN
      if (Number.isFinite(value)) return Math.min(Math.max(Math.round(value), 200), 560)
    } catch {
      /* ignore */
    }
    return 264
  })

  const beginSidebarResize = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget as HTMLElement
    const startX = event.clientX
    const startWidth = sidebarWidth
    const onMove = (moveEvent: PointerEvent) => {
      const bodyWidth = handle.parentElement?.clientWidth ?? window.innerWidth
      const maxWidth = Math.max(240, Math.min(560, bodyWidth * 0.7))
      setSidebarWidth(Math.min(Math.max(startWidth + (moveEvent.clientX - startX), 200), maxWidth))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setSidebarWidth((current) => {
        try {
          localStorage.setItem('dsv:sidebar.width.v1', String(current))
        } catch {
          /* ignore */
        }
        return current
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const resetSidebarWidth = () => {
    setSidebarWidth(264)
    try {
      localStorage.setItem('dsv:sidebar.width.v1', '264')
    } catch {
      /* ignore */
    }
  }

  const mainViews = registry.getViews('main')
  const panelViews = registry.getViews('panel')
  const panelDock = prefs.getSnapshot().panelDock

  const windowStyle: React.CSSProperties = {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
    borderRadius: state.max ? '0px' : undefined
  }

  return h(
    'div',
    { className: 'dsv-window', style: windowStyle, 'data-dsv-window': 'true', 'data-peek': state.peek ? 'true' : 'false' },
    HANDLES.map((mode) =>
      h('div', {
        key: mode,
        className: 'dsv-handle',
        'data-h': mode,
        onPointerDown: (event: React.PointerEvent) => beginGesture(event, mode)
      })
    ),
    h(
      'div',
      { className: 'dsv-titlebar', onPointerDown: (event: React.PointerEvent) => beginGesture(event, 'move') },
      h('span', { className: 'dsv-titlebar-title' }, WINDOW_TITLE),
      h('span', { className: 'dsv-titlebar-path' }, document.activePath || cwd || cwdError || '未连接工作区'),
      h(
        'div',
        { className: 'dsv-titlebar-actions', onPointerDown: (event: React.PointerEvent) => event.stopPropagation() },
        document.dirtyCount > 0 ? h('span', { className: 'dsv-titlebar-badge' }, `${document.dirtyCount} 未保存`) : null,
        h('button', { title: '转到文件（Ctrl+Alt+P）', onClick: () => palette.open('files') }, '⌕'),
        h('button', { title: '命令面板（Ctrl+Alt+Shift+P）', onClick: () => palette.open('commands') }, '>'),
        h('button', { title: '刷新工作区', onClick: () => void loadRoot() }, '↻'),
        h(
          'button',
          { title: '最小化到对话（Ctrl+Alt+Q，再次点击或按快捷键返回）', onClick: () => layout.togglePeek() },
          '–'
        ),
        h('button', { title: state.max ? '还原' : '最大化', onClick: () => layout.setMax(!state.max) }, state.max ? '⤡' : '⤢'),
        h('button', { title: '关闭（几何会记住）', onClick: () => layout.close() }, '✕')
      )
    ),
    h(
      'div',
      { className: 'dsv-body' },
      h(SidebarHost, { ctx, width: sidebarWidth }),
      h('div', {
        className: 'dsv-sidebar-resize',
        onPointerDown: beginSidebarResize,
        onDoubleClick: resetSidebarWidth,
        title: '拖动调整侧栏宽度（双击恢复默认）'
      }),
      h(
        'div',
        { className: 'dsv-main' },
        mainViews.map((view) => h(view.component, { key: view.id, ctx })),
        panelDock === 'bottom'
          ? h('div', { className: 'dsv-panel-bottom' }, panelViews.map((view) => h(view.component, { key: view.id, ctx })))
          : null
      ),
      panelDock === 'right'
        ? h(
            'div',
            { className: 'dsv-panel-dock' },
            panelViews.map((view) => h(view.component, { key: view.id, ctx }))
          )
        : null
    ),
    h(Palette, null),
    registry.getOverlays().map((overlay) => h(overlay.component, { key: overlay.id, ctx })),
    h(
      'div',
      { className: 'dsv-statusbar' },
      h(
        'span',
        null,
        h('span', { className: 'dsv-dot', 'data-state': host === 'ok' ? 'ok' : host === 'fail' ? 'bad' : 'warn' }),
        host === 'ok' ? '宿主已连接' : host === 'fail' ? '宿主未连接' : '检测中…'
      ),
      remote ? h('span', { className: 'dsv-remote-chip', title: '文件操作走 SFTP' }, '远程 · SFTP') : null,
      registry.getStatusItems().map((item) =>
        h('span', { key: item.id, className: 'dsv-status-item' }, item.render(ctx))
      ),
      h('span', { className: 'dsv-spacer' }),
      h('span', null, cwd || '无工作区'),
      h('span', null, `会话 ${sessionId ? sessionId.slice(0, 8) : '—'}`),
      // 速览：临时隐藏工作台去看 DSH，再按一次原样回来
      h(
        'button',
        {
          className: 'dsv-status-btn',
          title: '速览 DSH（临时隐藏工作台，Ctrl+Alt+Q）',
          onClick: () => layout.togglePeek()
        },
        '对话'
      ),
      // 状态栏永远在最底下、不会被系统窗口按钮盖住：最大化时这里是退出出口
      state.max
        ? h('button', { className: 'dsv-status-btn', title: '退出最大化', onClick: () => layout.setMax(false) }, '⤡ 还原')
        : null,
      h('span', null, `v${(window as unknown as { __dsv?: { version?: string } }).__dsv?.version ?? '?'}`)
    )
  )
}
