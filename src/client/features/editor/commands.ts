/** 编辑器命令：保存 / 关闭 / 草稿 / 对比。 */

import { registerCommand } from '../../kernel/commands'
import { palette } from '../../kernel/palette'
import { clearDrafts } from './drafts'
import { workspace } from './monaco/workspace'

export function registerEditorCommands(): () => void {
  const disposers = [
    registerCommand({
      id: 'file.save',
      title: '保存当前文件',
      category: '文件',
      keybinding: 'Ctrl+S',
      run: () => {
        const active = workspace.getSnapshot().active
        if (active) return workspace.save(active)
      }
    }),
    registerCommand({
      id: 'file.saveAll',
      title: '保存全部文件',
      category: '文件',
      keybinding: 'Ctrl+Alt+S',
      run: () => workspace.saveAll()
    }),
    registerCommand({
      id: 'file.close',
      title: '关闭当前标签',
      category: '文件',
      keybinding: 'Ctrl+W',
      run: () => {
        const active = workspace.getSnapshot().active
        if (active) workspace.close(active)
      }
    }),
    registerCommand({
      id: 'file.closeAll',
      title: '关闭全部标签',
      category: '文件',
      run: () => workspace.closeAll()
    }),
    registerCommand({
      id: 'workbench.clearDrafts',
      title: '清除所有未保存草稿',
      category: '工作台',
      run: () => {
        if (!window.confirm('将丢弃所有未保存的草稿（已打开的标签不受影响），继续？')) return
        clearDrafts()
      }
    }),
    registerCommand({
      id: 'diff.compareWithDisk',
      title: '当前文件：与磁盘版本比较',
      category: '对比',
      run: () => workspace.compareWithDisk()
    }),
    registerCommand({
      id: 'diff.compareFiles',
      title: '比较两个文件…',
      category: '对比',
      run: () => {
        palette.pick('选择左侧文件', (left) => {
          palette.pick('选择右侧文件', (right) => {
            void workspace.compareFiles(left, right)
          })
        })
      }
    }),
    registerCommand({
      id: 'git.compareWithHead',
      title: 'Git：当前文件与 HEAD 比较',
      category: 'Git',
      run: () => workspace.compareWithHead()
    })
  ]

  return () => {
    for (const dispose of disposers) dispose()
  }
}
