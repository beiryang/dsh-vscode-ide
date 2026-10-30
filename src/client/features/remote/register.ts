/** 远程 feature 注册：侧栏视图 */

import { registry } from '../../kernel/registry'
import { dshInject, dshService, setDirectoryFlowState } from '../../kernel/dshContext'
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

  // 接管 DSH「添加工作区」的目录选择流程：本地仍走系统选择器，远程用镜像路径回调。
  // 必须放在 dshInject 里：我们的客户端插件只 inject 了 uiSession，slots/uiWorkspace
  // 可能比 apply 晚就绪；直接 ctx.get 会抛 "without inject"（之前就是这个原因没生效）。
  const registerDirectoryFlow = (scope: Record<string, unknown>) => {
    const slots = scope.slots as
      | {
          inject?: (name: string, factory: () => () => void) => () => void
          register?: (options: Record<string, unknown>, component: unknown) => () => void
        }
      | undefined
    const uiWorkspace = scope.uiWorkspace as { pickDirectory?: () => Promise<string | null> } | undefined

    if (!slots || typeof slots.inject !== 'function' || typeof slots.register !== 'function') {
      setDirectoryFlowState('slots 服务不可用')
      return
    }

    const inject = () => ({
      pick: () => {
        const desktop = (globalThis as unknown as { __DSH_DIRECTORY_PICKER__?: { pick?: () => Promise<string | null> } })
          .__DSH_DIRECTORY_PICKER__
        if (desktop && typeof desktop.pick === 'function') return desktop.pick()
        if (uiWorkspace && typeof uiWorkspace.pickDirectory === 'function') return uiWorkspace.pickDirectory()
        return Promise.resolve(null)
      }
    })

    const names = ['conversation.hero.workspace.directoryFlow', 'sidebar.workspaces.directoryFlow']
    let registered = 0
    for (const name of names) {
      try {
        const dispose = slots.inject(name, () => slots.register!({ name, priority: -100, inject }, DirectoryFlow))
        if (typeof dispose === 'function') disposers.push(dispose)
        registered += 1
      } catch (error) {
        setDirectoryFlowState(`注册失败：${error instanceof Error ? error.message : String(error)}`)
      }
    }
    if (registered > 0) setDirectoryFlowState(`已接管 ${registered} 个目录流程`)
  }

  // 有 cordis inject 就等 slots/uiWorkspace 就绪；没有就立即尝试
  let injected = false
  try {
    const result = dshInject(['slots', 'uiWorkspace'], registerDirectoryFlow)
    injected = typeof result === 'function'
    disposers.push(result)
  } catch {
    injected = false
  }
  if (!injected) {
    const immediate: Record<string, unknown> = {
      slots: dshService('slots'),
      uiWorkspace: dshService('uiWorkspace')
    }
    registerDirectoryFlow(immediate)
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
