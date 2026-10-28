/**
 * 内核命令：窗口、面板、导航这类跟具体 feature 无关的动作。
 *
 * feature 自己的命令放在各自 `register()` 里，不再集中到一处 ——
 * 这样新增/删除一个 feature 不需要回来改内核。
 */

import { api } from './transport'
import { registerCommand } from './commands'
import { loadFiles, invalidateFiles } from './files'
import { layout } from './layout'
import { palette } from './palette'
import { runProbe } from './probe'

export function registerKernelCommands(): () => void {
  const disposers = [
    registerCommand({
      id: 'go.toFile',
      title: '转到文件…',
      category: '导航',
      keybinding: 'Ctrl+Alt+P',
      run: () => {
        void loadFiles().catch(() => undefined)
        palette.open('files')
      }
    }),
    registerCommand({
      id: 'go.commandPalette',
      title: '显示所有命令',
      category: '导航',
      keybinding: 'Ctrl+Alt+Shift+P',
      run: () => palette.open('commands')
    }),
    registerCommand({
      id: 'view.toggleMaximize',
      title: '窗口最大化 / 还原',
      category: '外观',
      run: () => layout.setMax(!layout.getSnapshot().max)
    }),
    registerCommand({
      id: 'view.resetGeometry',
      title: '重置窗口位置与大小',
      category: '外观',
      run: () => layout.resetGeometry()
    }),
    registerCommand({
      id: 'workbench.reloadWorkspace',
      title: '刷新工作区索引',
      category: '工作台',
      run: async () => {
        invalidateFiles()
        await loadFiles(true)
        await api.roots()
      }
    }),
    registerCommand({
      id: 'workbench.probe',
      title: '运行环境探针并存盘',
      category: '工作台',
      run: async () => {
        const result = await runProbe()
        console.log('[dsh-vscode-ide] probe', result)
      }
    })
  ]

  return () => {
    for (const dispose of disposers) dispose()
  }
}
