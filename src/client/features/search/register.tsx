/** 搜索 feature：浮动搜索面板 + `Ctrl+Alt+Shift+F` 入口。 */

import { registerCommand } from '../../kernel/commands'
import { layout } from '../../kernel/layout'
import { registry } from '../../kernel/registry'
import { searchPanel } from './panel'
import { SearchOverlay } from './SearchOverlay'
import { CSS } from './styles'

export function registerSearchFeature(): () => void {
  const disposers = [
    registry.addStyles(CSS),
    registry.registerOverlay({
      apiVersion: 1,
      id: 'search-overlay',
      component: SearchOverlay
    }),
    registerCommand({
      id: 'search.inFiles',
      title: '在文件中搜索',
      category: '搜索',
      keybinding: 'Ctrl+Alt+Shift+F',
      run: () => {
        layout.open()
        searchPanel.open()
  ;(window as unknown as { __dsvOpenSearch?: () => void }).__dsvOpenSearch = () => searchPanel.open()
      }
    })
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
