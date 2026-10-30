/**
 * 保存 DSH 客户端根 ctx，供 feature 调用 DSH 自己的服务（例如 uiWorkspace）。
 *
 * 注意：feature 不能直接拿到 DSH 的根 ctx（只拿 WorkbenchContext），
 * 所以在客户端 apply 时存一份只读引用，通过明确的函数暴露需要的动作。
 */

type LooseCtx = { get?: (name: string) => unknown }

let root: LooseCtx | null = null

export function setDshContext(ctx: unknown) {
  root = (ctx as LooseCtx | null) ?? null
}

/** 通过 DSH 的 uiWorkspace 打开一个原生工作区（镜像目录对应的工作区） */
export function openDshWorkspace(workspaceId: string): { ok: boolean; error?: string } {
  if (!workspaceId) return { ok: false, error: '缺少工作区 id' }
  try {
    const uiWorkspace = root?.get?.('uiWorkspace') as
      | { openWorkspace?: (id: string) => unknown }
      | undefined
    if (!uiWorkspace || typeof uiWorkspace.openWorkspace !== 'function') {
      return { ok: false, error: 'DSH 的 uiWorkspace 服务不可用' }
    }
    void uiWorkspace.openWorkspace(workspaceId)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** 只读拿到 DSH 客户端的根 ctx（feature 注册 slot 时用） */
export function getDshContext(): LooseCtx | null {
  return root
}

/** 取一个 DSH 客户端服务（优先直接属性，其次 ctx.get） */
export function dshService<T = unknown>(name: string): T | undefined {
  try {
    const anyRoot = root as unknown as Record<string, unknown> | null
    if (!anyRoot) return undefined
    if (name in anyRoot) return anyRoot[name] as T
    return typeof anyRoot.get === 'function' ? (anyRoot.get(name) as T) : undefined
  } catch {
    return undefined
  }
}
