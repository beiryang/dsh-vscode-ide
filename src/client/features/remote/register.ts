/** 远程 feature 注册：侧栏视图 */

import { registry } from '../../kernel/registry'
import { RemoteView } from './RemoteView'
import { CSS } from './styles'

export function registerRemoteFeature(): () => void {
  const disposers: Array<() => void> = [registry.addStyles(CSS)]

  disposers.push(
    registry.registerView({
      apiVersion: 1,
      id: 'remote',
      title: '远程',
      region: 'sidebar',
      order: 30,
      icon: 'globe',
      component: RemoteView
    })
  )

  return () => {
    for (const dispose of disposers.splice(0)) {
      try {
        dispose()
      } catch {
        /* ignore */
      }
    }
  }
}
