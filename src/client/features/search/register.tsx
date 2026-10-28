/** 搜索 feature：侧栏「搜索」视图 + `Ctrl+Alt+F` 入口。 */

import { registerCommand } from '../../kernel/commands'
import { layout } from '../../kernel/layout'
import { registry } from '../../kernel/registry'
import { sidebar } from '../../kernel/sidebar'
import { SearchView } from './SearchView'
import { CSS } from './styles'

export function registerSearchFeature(): () => void {
  const disposers = [
    registry.addStyles(CSS),
    registry.registerView({
      apiVersion: 1,
      id: 'search',
      title: '搜索',
      region: 'sidebar',
      order: 15,
      component: SearchView
    }),
    registerCommand({
      id: 'search.inFiles',
      title: '在文件中搜索',
      category: '搜索',
      keybinding: 'Ctrl+Alt+F',
      run: () => {
        layout.open()
        sidebar.setActive('search')
        window.dispatchEvent(new Event('dsv:focus-search'))
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
