/** 资源管理器 feature：侧栏「资源管理器」视图。 */

import * as React from 'react'

import { h } from '../../h'
import { customIcons } from '../../kernel/custom-icons'
import { registry, type WorkbenchContext } from '../../kernel/registry'
import { api, type Entry } from '../../kernel/transport'
import { CSS } from './styles'
import { FileTree } from './FileTree'
import { loadIcons } from './icons'

function ExplorerView({ ctx }: { ctx: WorkbenchContext }) {
  const document = React.useSyncExternalStore(registry.subscribeDocument, registry.getDocumentState)
  return h(FileTree, {
    cwd: ctx.cwd,
    activePath: document.activePath,
    onOpen: (entry: Entry) => registry.openFile(entry.path, { name: entry.name })
  })
}

export function registerExplorerFeature(): () => void {
  // 图标资源 1.2 MB，懒加载：只影响文件树，不拖慢主 bundle
  void loadIcons()
  // 上次导入过自定义图标的话，按路径让宿主重新读一遍
  void customIcons.restore((path) => api.importIcons(path))

  const disposers = [
    registry.addStyles(CSS),
    registry.registerView({
      apiVersion: 1,
      id: 'explorer',
      title: '资源管理器',
      icon: '▤',
      region: 'sidebar',
      order: 10,
      component: ExplorerView
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
