/** 远程 feature 注册：侧栏视图 */

import { registry } from '../../kernel/registry'
import { dshInject, dshService, setDirectoryFlowState } from '../../kernel/dshContext'
import { installRemoteWorkspaceAppearance } from './appearance'
import { DirectoryFlow, type LocalBrowse } from './DirectoryFlow'
import { RemoteProbe } from './RemoteProbe'
import { RemoteView } from './RemoteView'
import { CSS } from './styles'

export function registerRemoteFeature(): () => void {
  const disposers: Array<() => void> = [registry.addStyles(CSS), installRemoteWorkspaceAppearance()]

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
    const uiWorkspace = scope.uiWorkspace as UiWorkspaceLike | undefined

    if (!slots || typeof slots.inject !== 'function' || typeof slots.register !== 'function') {
      setDirectoryFlowState('slots 服务不可用')
      return
    }

    // 每次 inject 都复用同一个适配对象：DirectoryFlow 以它作为探测 effect 的依赖。
    const browseLocal = toLocalBrowse(uiWorkspace)
    const inject = () => ({
      pick: () => {
        const desktop = (globalThis as unknown as { __DSH_DIRECTORY_PICKER__?: { pick?: () => Promise<string | null> } })
          .__DSH_DIRECTORY_PICKER__
        if (desktop && typeof desktop.pick === 'function') return desktop.pick()
        if (uiWorkspace && typeof uiWorkspace.pickDirectory === 'function') return uiWorkspace.pickDirectory()
        return Promise.resolve(null)
      },
      ...(browseLocal === undefined ? {} : { browseLocal })
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

/** DSH `uiWorkspace` 里本流程用到的目录原语（宿主未合成 browse 能力时 list 会拒绝）。 */
type UiWorkspaceLike = {
  pickDirectory?: () => Promise<string | null>
  listDirectory?: (path?: string) => Promise<{
    path: string
    crumbs?: Array<{ name: string; path: string }>
    entries?: Array<{ name: string; path: string; hidden?: boolean }>
  }>
}

/**
 * 把 uiWorkspace 的列目录原语适配成「宿主应用内浏览」。
 *
 * 宿主合成 native 后端时 uiWorkspace.listDirectory 依旧存在、只是以
 * directory-picker/unavailable 拒绝，由 DirectoryFlow 据此退回系统选择器。
 */
function toLocalBrowse(uiWorkspace: UiWorkspaceLike | undefined): LocalBrowse | undefined {
  if (!uiWorkspace || typeof uiWorkspace.listDirectory !== 'function') return undefined
  // 类方法不带绑定：先 bind 再交出去，否则调用时 this 丢失。
  const listDirectory = uiWorkspace.listDirectory.bind(uiWorkspace)
  return {
    list: async (path) => {
      const listing = await listDirectory(path)
      const crumbs = Array.isArray(listing?.crumbs) ? listing.crumbs : []
      const index = listing?.path ? crumbs.findIndex((crumb) => crumb.path === listing.path) : -1
      return {
        path: String(listing?.path ?? ''),
        ...(index > 0 ? { parent: crumbs[index - 1].path } : {}),
        entries: (listing?.entries ?? [])
          .filter((entry) => entry.hidden !== true)
          .map((entry) => ({ name: entry.name, path: entry.path, type: 'directory' }))
      }
    }
  }
}
