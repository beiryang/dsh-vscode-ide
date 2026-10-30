/** 远程 feature 注册：侧栏视图 */

import { registry } from '../../kernel/registry'
import { dshService } from '../../kernel/dshContext'
import { DirectoryFlow } from './DirectoryFlow'
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

  // 接管 DSH「添加工作区」的目录选择流程：本地仍走系统选择器，远程用镜像路径回调
  const slots = dshService<{
    inject?: (name: string, factory: () => () => void) => () => void
    register?: (options: Record<string, unknown>, component: unknown) => () => void
  }>('slots')
  const uiWorkspace = dshService<{ pickDirectory?: () => Promise<string | null> }>('uiWorkspace')
  if (slots && typeof slots.inject === 'function' && typeof slots.register === 'function') {
    const inject = () => ({
      pick: () => {
        const desktop = (globalThis as unknown as { __DSH_DIRECTORY_PICKER__?: { pick?: () => Promise<string | null> } })
          .__DSH_DIRECTORY_PICKER__
        if (desktop && typeof desktop.pick === 'function') return desktop.pick()
        if (uiWorkspace && typeof uiWorkspace.pickDirectory === 'function') return uiWorkspace.pickDirectory()
        return Promise.resolve(null)
      }
    })
    for (const name of ['conversation.hero.workspace.directoryFlow', 'sidebar.workspaces.directoryFlow']) {
      try {
        disposers.push(
          slots.inject(name, () => slots.register?.({ name, priority: -100, inject }, DirectoryFlow) ?? (() => {}))
        )
      } catch {
        /* ignore */
      }
    }
  }

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
