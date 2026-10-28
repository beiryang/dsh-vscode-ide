/**
 * 壳的根组件：主题桥、会话绑定、全局快捷键、窗口。
 */

import * as React from 'react'

import { h } from '../h'
import { applyTheme, watchTheme } from './theme'
import { themeStore } from './themes'
import { connectSession, sessionStore } from './session'
import { layout } from './layout'
import { palette } from './palette'
import { registry } from './registry'
import { runCommand } from './commands'
import { WorkbenchWindow } from './window/Window'
import { PeekFab } from './window/PeekFab'

export function App({ ctx }: { ctx: unknown }) {
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const sessionId = React.useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot)

  React.useEffect(() => connectSession(ctx as { get?: (name: string) => unknown }), [ctx])

  React.useEffect(() => {
    applyTheme(rootRef.current)
    // DSH 切深浅色时广播出去，feature（比如 Monaco 主题）自己响应
    const stopWatch = watchTheme(rootRef.current, () => registry.emitThemeChanged())
    // 用户切换内置主题时同样重刷
    const stopTheme = themeStore.subscribe(() => {
      applyTheme(rootRef.current)
      registry.emitThemeChanged()
    })
    return () => {
      stopWatch()
      stopTheme()
    }
  }, [])

  React.useEffect(() => {
    const openPalette = (mode: 'files' | 'commands') => {
      if (!layout.getSnapshot().open) layout.open()
      palette.open(mode)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      // Ctrl+P / Ctrl+Shift+P 被 DSH 自己的文件面板占用（先于我们注册），
      // 所以主快捷键改用 Ctrl+Alt 家族：Ctrl+Alt+P 转到文件、加 Shift 打开命令面板。
      if (event.ctrlKey && event.altKey && event.code === 'KeyP') {
        event.preventDefault()
        event.stopPropagation()
        openPalette(event.shiftKey ? 'commands' : 'files')
        return
      }

      if (event.key === 'Escape' && palette.getSnapshot().open) {
        event.preventDefault()
        palette.close()
        return
      }

      const isToggle = event.ctrlKey && event.altKey && (event.code === 'KeyI' || event.key.toLowerCase() === 'i')
      if (isToggle) {
        event.preventDefault()
        event.stopPropagation()
        layout.toggle()
        return
      }
      // 速览：临时藏起工作台看 DSH，再按一次原样回来
      const isPeek = event.ctrlKey && event.altKey && (event.code === 'KeyQ' || event.key.toLowerCase() === 'q')
      if (isPeek) {
        event.preventDefault()
        event.stopPropagation()
        layout.togglePeek()
        return
      }
      // 全局搜索：打开侧栏搜索视图并聚焦输入框
      const isSearch = event.ctrlKey && event.altKey && (event.code === 'KeyF' || event.key.toLowerCase() === 'f')
      if (isSearch) {
        event.preventDefault()
        event.stopPropagation()
        void runCommand('search.inFiles')
        return
      }
      // Esc 关窗作为逃生出口：编辑区/输入框里不抢（那里 Esc 有别的用途），
      // 其余情况一律关 —— 窗口被盖住时这是最可靠的退路
      if (event.key === 'Escape' && layout.getSnapshot().open) {
        const target = event.target as HTMLElement | null
        const editing = typeof target?.closest === 'function' && target.closest('.monaco-editor, input, textarea')
        if (!editing) {
          event.preventDefault()
          layout.close()
        }
      }
    }
    // 捕获阶段先于 DSH 的全局快捷键，避免被对话界面吞掉
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  return h(
    'div',
    { className: 'dsv-root', ref: rootRef, 'data-dsv-root': 'true' },
    h(WorkbenchWindow, { sessionId }),
    h(PeekFab, null)
  )
}
