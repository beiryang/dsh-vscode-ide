/** Git 命令：刷新 / 暂存 / 推送。 */

import { registerCommand } from '../../kernel/commands'
import { git } from './git'

export function registerGitCommands(): () => void {
  const disposers = [
    registerCommand({
      id: 'git.refresh',
      title: 'Git：刷新状态',
      category: 'Git',
      run: () => git.refresh()
    }),
    registerCommand({
      id: 'git.stageAll',
      title: 'Git：暂存全部更改',
      category: 'Git',
      run: () => git.stageAll()
    }),
    registerCommand({
      id: 'git.push',
      title: 'Git：推送当前分支',
      category: 'Git',
      run: () => git.push()
    })
  ]

  return () => {
    for (const dispose of disposers) dispose()
  }
}
