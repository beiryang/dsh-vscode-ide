/**
 * dsh-vscode-ide —— 宿主半边。
 *
 * 只做一件事：给客户端提供 HTTP 路由（文件读写 + 静态资源）以及探针信息。
 * 不注册 Agent 工具、不碰 DSH 的 UI、不写用户的任何配置文件。
 *
 * 客户端半边（lib/client.js）由 DSH 自行注入，入口见 package.json 的
 * exports["./client"] 与 dsh.client.platform。
 */

import { appendFileSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { PREFIX, registerRoutes } from './host/routes.js'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

/** 内置远程的挂载诊断：写到 ~/.dsh/code-space-remote.log，出问题可直接看 */
function remoteLog(line) {
  try {
    appendFileSync(join(homedir(), '.dsh', 'code-space-remote.log'), `${new Date().toISOString()} ${line}\n`)
  } catch {
    /* ignore */
  }
}

export const name = 'dsh-vscode-ide'

/**
 * 可选：把 dsh-remote-ssh 的宿主半边（MIT，见 lib/host/remote-ssh/NOTICE.md）
 * 挂进本插件，做到「只装一个插件」也有远程工作区、镜像同步和 remote_ssh_* 工具。
 *
 * 默认启用（单插件目标）：外部 dsh-remote-ssh 必须停用/卸载，否则两边会注册同名工具与
 * /remote-ssh/api 路由。临时排查可设 DSV_BUILTIN_REMOTE_SSH=0 关掉它。
 */
const ENABLE_BUILTIN_REMOTE = process.env.DSV_BUILTIN_REMOTE_SSH !== '0'

/**
 * 只依赖 webServer：sessions 在请求时才通过 ctx.get('sessions') 取，
 * 这样即使插件比会话服务先激活也不会让整个 bundle 加载失败。
 * 内置远程需要的 subprocess/tools/workspaceRegistry 由 apply 里的 ctx.inject 等待，
 * 不写进这里，避免某个版本缺服务时连 Code Space 一起挂不起来。
 */
export const inject = ['webServer']

export function apply(ctx) {
  const log = (message) => {
    try {
      if (ctx.logger && typeof ctx.logger.info === 'function') ctx.logger.info(`[dsh-vscode-ide] ${message}`)
      else console.log(`[dsh-vscode-ide] ${message}`)
    } catch {
      /* 日志失败不影响功能 */
    }
  }
  const warn = (message) => {
    try {
      if (ctx.logger && typeof ctx.logger.warn === 'function') ctx.logger.warn(`[dsh-vscode-ide] ${message}`)
      else console.warn(`[dsh-vscode-ide] ${message}`)
    } catch {
      /* 同上 */
    }
  }

  // 宿主半边同样不允许抛错：插件坏了要能降级，不能拖住 DSH 启动。
  try {
    const dispose = registerRoutes(ctx, { name: pkg.name, version: pkg.version })

    if (typeof ctx.effect === 'function') {
      ctx.effect(
        () => () => {
          try {
            if (typeof dispose === 'function') dispose()
          } catch {
            /* ignore */
          }
          void disposeRuntime()
        },
        'dsh-vscode-ide: web routes'
      )
    }

    log(`v${pkg.version} 已挂载 ${PREFIX}（health / assets / api）`)

    remoteLog(`apply: enabled=${ENABLE_BUILTIN_REMOTE} node=${process.version}`)
    if (ENABLE_BUILTIN_REMOTE) {
      const mount = () => void mountBuiltinRemote(ctx, log, warn)
      const needed = ['subprocess', 'tools', 'workspaceRegistry']
      if (typeof ctx.inject === 'function') {
        try {
          ctx.inject(needed, mount)
        } catch {
          mount()
        }
      } else {
        mount()
      }
    }
  } catch (error) {
    warn(`挂载失败（插件降级为不可用）：${(error && error.stack) || error}`)
  }
}

/** 挂载内置的 dsh-remote-ssh 兼容层（仅 DSV_BUILTIN_REMOTE_SSH=1 时） */
async function mountBuiltinRemote(ctx, log, warn) {
  remoteLog('mount: start')
  try {
    const services = ['subprocess', 'tools', 'workspaceRegistry']
    for (const name of services) {
      let present = false
      try {
        present = !!(typeof ctx.get === 'function' && ctx.get(name))
      } catch {
        present = false
      }
      remoteLog(`mount: service ${name} = ${present}`)
    }
    remoteLog(`mount: ctx.inject = ${typeof ctx.inject} ctx.plugin = ${typeof ctx.plugin}`)
    const mod = await import('./host/remote-ssh/index.js')
    remoteLog(`mount: imported, apply=${typeof mod.apply} inject=${JSON.stringify(mod.inject)}`)
    if (typeof mod.apply !== 'function') throw new Error('内置远程：入口没有导出 apply')

    // 它导出了自己的 inject（subprocess/tools/workspaceRegistry），交给 cordis 管理：
    // 手动 apply(outerCtx) 会因为没有声明 inject 而报 "cannot get property ... without inject"。
    if (typeof ctx.plugin === 'function') {
      try {
        ctx.plugin({ name: mod.name, inject: mod.inject, apply: mod.apply, Config: mod.Config })
        remoteLog('mount: ctx.plugin accepted')
      } catch (pluginError) {
        remoteLog(`mount: ctx.plugin failed, falling back to inject: ${(pluginError && pluginError.stack) || pluginError}`)
        ctx.inject(['subprocess', 'tools', 'workspaceRegistry'], (sctx) => {
          mod.apply(sctx || ctx)
          remoteLog('mount: applied via ctx.inject child context')
        })
      }
    } else {
      ctx.inject(['subprocess', 'tools', 'workspaceRegistry'], (sctx) => {
        mod.apply(sctx || ctx)
        remoteLog('mount: applied via ctx.inject child context')
      })
    }
    remoteLog('mount: scheduled OK')
    log('内置远程兼容层已挂载（remote_ssh_* 工具、/remote-ssh/api、镜像同步）')
  } catch (error) {
    remoteLog(`mount: FAILED ${(error && error.stack) || error}`)
    warn(`内置远程挂载失败（保持原样）：${(error && error.stack) || error}`)
  }
}

/** 关闭所有 SSH 终端会话与 SFTP 连接（插件停用 / DSH 退出时） */
async function disposeRuntime() {
  try {
    const { disposeAll } = await import('./host/terminal.js')
    disposeAll()
  } catch {
    /* ignore */
  }
  try {
    const { closeRemoteConnections } = await import('./host/remote-fs.js')
    await closeRemoteConnections()
  } catch {
    /* ignore */
  }
}
