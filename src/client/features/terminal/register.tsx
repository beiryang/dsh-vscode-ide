/** 终端 feature：底部面板 + 状态栏按钮 + 终端命令。 */

import { h } from '../../h'
import { prefs } from '../../kernel/prefs'
import { registry } from '../../kernel/registry'
import { registerTerminalCommands } from './commands'
import { CSS } from './styles'
import { SshDialog } from './SshDialog'
import { sshDialog } from './sshTargets'
import { TerminalPanel } from './TerminalPanel'
import { terminal } from './terminal'
import { syncTerminalFont, syncTerminalTheme } from './theme'

function TerminalPanelView() {
  return h(TerminalPanel, null)
}

function TerminalButton() {
  return h(
    'button',
    { className: 'dsv-status-btn', title: '显示 / 收起终端面板', onClick: () => terminal.toggle() },
    '终端'
  )
}

export function registerTerminalFeature(): () => void {
  const disposers = [
    registry.addStyles(CSS),
    // 主题切换时把已打开的终端一起换色
    registry.subscribeTheme(() => syncTerminalTheme()),
    // 字号设置变化时同步已打开的终端（并重新 fit）
    prefs.subscribe(() => syncTerminalFont()),
    registry.registerView({
      apiVersion: 1,
      id: 'terminal',
      title: '终端',
      region: 'panel',
      order: 10,
      component: TerminalPanelView
    }),
    registry.registerOverlay({
      apiVersion: 1,
      id: 'ssh-dialog',
      component: SshDialog
    }),
    registry.registerStatusItem({
      apiVersion: 1,
      id: 'terminal.toggle',
      order: 20,
      render: () => h(TerminalButton, null)
    }),
    registerTerminalCommands()
  ]
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
