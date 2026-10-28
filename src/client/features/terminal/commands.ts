/** 终端命令：新建 SSH / 本地、开关面板、关闭当前。 */

import { registerCommand } from '../../kernel/commands'
import { terminal } from './terminal'

export function registerTerminalCommands(): () => void {
  const disposers = [
    registerCommand({
      id: 'terminal.new',
      title: '终端：新建 SSH 终端',
      category: '终端',
      keybinding: 'Ctrl+Alt+T',
      run: () => terminal.create()
    }),
    registerCommand({
      id: 'terminal.newLocal',
      title: '终端：新建本地 PowerShell（命令控制台）',
      category: '终端',
      run: () => terminal.createLocal()
    }),
    registerCommand({
      id: 'terminal.toggle',
      title: '终端：显示 / 收起面板',
      category: '终端',
      run: () => terminal.toggle()
    }),
    registerCommand({
      id: 'terminal.closeCurrent',
      title: '终端：关闭当前终端',
      category: '终端',
      run: () => {
        const current = terminal.getSnapshot()
        if (current.activeId) void terminal.closeSession(current.activeId)
      }
    })
  ]

  return () => {
    for (const dispose of disposers) dispose()
  }
}
