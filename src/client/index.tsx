/**
 * 客户端入口（DSH 用 `window.__ModuleLoader__.load` 加载这个 bundle）。
 *
 * 只做四件事：
 *   1. 注入样式、往 document.body 挂一个 React 根（壳自挂，完全自主布局）
 *   2. 暴露 window.__dsv 与 ctx.vscodeIde 服务（契约 v1：视图 / 状态项 / 命令）
 *   3. 往 DSH 插槽注册两个入口：左侧栏入口、设置页分区
 *   4. 用 ctx.effect 保证插件停用/HMR 时干净卸载
 *
 * 除此之外不碰 DSH 的任何东西 —— 插槽 API 变了最多丢入口，不会丢整个 IDE。
 */

import * as React from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './kernel/app'
import { api } from './kernel/transport'
import { registerCommand, listCommands, runCommand } from './kernel/commands'
import { registerKernelCommands } from './kernel/core-commands'
import { layout } from './kernel/layout'
import { publicApi, registry } from './kernel/registry'
import { runProbe } from './kernel/probe'
import { registerEditorFeature } from './features/editor/register'
import { registerExplorerFeature } from './features/explorer/register'
import { registerGitFeature } from './features/git/register'
import { registerTerminalFeature } from './features/terminal/register'
import { CSS } from './kernel/styles'
import { CSS as DSH_CSS } from './dsh/styles'
import { Launcher } from './dsh/launcher'
import { NAV_LABEL, SHORT_NAME } from './dsh/brand'
import { SettingsSection } from './dsh/settings'

declare const __DSV_VERSION__: string

const BUNDLE_ID = 'dsh-vscode-ide'
const LOCALE_NS = 'dsv'
const DICT = {
  zh: { nav: NAV_LABEL, settings: SHORT_NAME },
  en: { nav: NAV_LABEL, settings: SHORT_NAME }
}

type AnyCtx = {
  effect?: (fn: () => void | (() => void), label?: string) => void
  get?: (name: string) => any
  provide?: (name: string, value: unknown) => void
  inject?: (names: string[], run: (scoped: any) => void) => void
}

export const inject = ['uiSession']

export function apply(ctx: AnyCtx) {
  // 客户端入口绝不允许把 DSH 的 web boot 弄挂：任何异常都只降级，不冒泡。
  try {
    applyUnsafe(ctx)
  } catch (error) {
    console.error('[dsh-vscode-ide] 客户端挂载失败（插件已降级为不可用，不影响 DSH）', error)
  }
}

function applyUnsafe(ctx: AnyCtx) {
  if (typeof document === 'undefined' || !document.body) return
  const global = window as unknown as Record<string, unknown>
  if (global.__dsv) return // 幂等：重复激活 / HMR 时直接复用已有实例

  const style = document.createElement('style')
  style.setAttribute('data-dsv-style', '')
  style.textContent = CSS
  document.head.appendChild(style)

  // feature 的 CSS 段由 registry.addStyles() 汇总进这个标签
  const featureStyle = document.createElement('style')
  featureStyle.setAttribute('data-dsv-feature-style', '')
  document.head.appendChild(featureStyle)
  registry.attachStyleElement(featureStyle)
  // 插槽侧（左侧栏入口 / 设置页）的样式不属于任何 feature，由装配层直接注入
  registry.addStyles(DSH_CSS)

  const host = document.createElement('div')
  host.setAttribute('data-dsv-host', '')
  document.body.appendChild(host)

  // 先注册 feature（视图/状态项/服务实现），再挂载壳：首帧就是完整界面
  // 设置页只放在 DSH 自己的设置里（settings.section），工作台内不再占位
  const disposeFeatures = [
    registerEditorFeature(),
    registerExplorerFeature(),
    registerGitFeature(),
    registerTerminalFeature()
  ]

  const root = createRoot(host)
  root.render(React.createElement(App, { ctx }))

  const service = {
    version: typeof __DSV_VERSION__ === 'string' ? __DSV_VERSION__ : '0.0.0',
    apiVersion: publicApi.apiVersion,
    layout,
    open: () => layout.open(),
    close: () => layout.close(),
    toggle: () => layout.toggle(),
    /** 扩展面：别的模块/插件可以注册命令，命令面板会自动列出来 */
    registerCommand,
    executeCommand: runCommand,
    listCommands,
    /** 契约 v1：往工作台里加视图 / 状态项 */
    registerView: publicApi.registerView,
    registerStatusItem: publicApi.registerStatusItem,
    getViews: registry.getViews,
    openFile: (path: string, name?: string) => registry.openFile(path, { name }),
    /**
     * `await __dsv.probe()`      → 返回探针结果
     * `await __dsv.probe(true)`  → 结果写到宿主临时目录，返回 { savedTo, result }
     */
    probe: async (save = false) => {
      const result = await runProbe()
      if (!save) return result
      try {
        const { path } = await api.saveProbe(result)
        console.log(`[dsh-vscode-ide] 探针结果已保存：${path}`)
        return { savedTo: path, result }
      } catch (error) {
        console.warn('[dsh-vscode-ide] 保存探针失败', error)
        return result
      }
    }
  }
  global.__dsv = service

  try {
    ctx.provide?.('vscodeIde', service)
  } catch (error) {
    console.warn('[dsh-vscode-ide] 发布 ctx.vscodeIde 失败', error)
  }

  const disposeCommands = registerKernelCommands()

  ctx.effect?.(() => () => {
    disposeCommands()
    for (const dispose of disposeFeatures) {
      try {
        dispose()
      } catch {
        /* ignore */
      }
    }
    try {
      root.unmount()
    } catch {
      /* 卸载失败不影响宿主 */
    }
    host.remove()
    style.remove()
    featureStyle.remove()
    registry.attachStyleElement(null)
    if (global.__dsv === service) delete global.__dsv
  }, 'dsh-vscode-ide: shell mount')

  registerLocale(ctx)
  registerSlots(ctx)

  console.log(`[${BUNDLE_ID}] v${service.version} 已挂载（__dsv.probe() 可做环境探针，Ctrl+Alt+I 开关）`)
}

function registerLocale(ctx: AnyCtx) {
  try {
    const locale = ctx.get?.('locale')
    if (!locale || typeof locale.register !== 'function') return
    ctx.effect?.(() => locale.register(LOCALE_NS, DICT), 'dsh-vscode-ide: locale')
  } catch (error) {
    console.warn('[dsh-vscode-ide] 注册语言词典失败（不影响使用）', error)
  }
}

/**
 * 入口走 DSH 插槽，主体自挂 —— 这是本插件的核心取舍。
 * slots 缺失（版本变化 / 未提供）时静默降级：快捷键与 window.__dsv 仍然可用。
 */
function registerSlots(ctx: AnyCtx) {
  if (typeof ctx.inject !== 'function') {
    console.warn('[dsh-vscode-ide] ctx.inject 不可用，跳过插槽入口')
    return
  }
  try {
    ctx.inject(['slots'], (scoped: any) => {
      const slots = scoped?.slots ?? ctx.get?.('slots')
      if (!slots || typeof slots.register !== 'function') return

      const register = (name: string, id: string, order: number, label: () => string, component: React.ComponentType<any>) => {
        try {
          return slots.inject(name, () =>
            slots.register(
              { name, id, order, label, locale: LOCALE_NS, inject: () => ({ ctx }) },
              component
            )
          )
        } catch (error) {
          console.warn(`[dsh-vscode-ide] 注册插槽 ${name} 失败`, error)
          return undefined
        }
      }

      register('sidebar.panellist', 'dsv.launcher', 60, () => NAV_LABEL, Launcher)
      register('settings.section', 'dsv.settings', 320, () => SHORT_NAME, SettingsSection)
    })
  } catch (error) {
    console.warn('[dsh-vscode-ide] 插槽不可用，仅保留快捷键与 __dsv', error)
  }
}
