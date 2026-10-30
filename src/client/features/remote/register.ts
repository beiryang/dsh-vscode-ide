/** 远程 feature 注册：侧栏视图 */

import { registry } from '../../kernel/registry'
import { RemoteProbe } from './RemoteProbe'
import { RemoteView } from './RemoteView'
import { CSS } from './styles'

export function registerRemoteFeature(): () => void {
  const disposers: Array<() => void> = [registry.addStyles(CSS)]

  disposers.push(
    registry.registerOverlay({
      apiVersion: 1,
      id: 'remote-probe',
      component: RemoteProbe
    })
  )

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
