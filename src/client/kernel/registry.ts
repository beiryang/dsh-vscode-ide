/**
 * 工作台内核：贡献点注册表（契约 v1）。
 *
 * 这里是 kernel 与 feature 之间**唯一**的耦合面：
 *   - 内核只认这些数据结构，不认识任何具体 feature 的代码
 *   - feature 通过 register* 把界面/命令/状态项塞进来
 *   - 外部插件拿到 ctx.vscodeIde 后用的也是同一套 API
 *
 * 约定：所有贡献都带 apiVersion。版本不认识就丢弃并告警，
 * 绝不能因为第三方模块写错字段把整个工作台搞崩。
 */

import type * as React from 'react'

export const API_VERSION = 1

/** 内核传给每个视图的上下文（视图只能通过它跟外界交互） */
export type WorkbenchContext = {
  sessionId: string
  cwd: string | null
  cwdError: string | null
  remote: boolean
  /** 打开文件（由 editor feature 提供实现） */
  openFile(path: string, options?: { name?: string; line?: number }): void
  /** 关闭工作台窗口 */
  closeWindow(): void
  /** 重新读取工作区根目录 */
  refreshWorkspace(): void
}

export type Region = 'sidebar' | 'main' | 'panel'

export type ViewContribution = {
  apiVersion?: number
  id: string
  title: string
  region: Region
  order?: number
  /** 不在页签栏里列出来，只能被程序激活（比如设置页） */
  hidden?: boolean
  component: React.ComponentType<{ ctx: WorkbenchContext }>
}

/** 叠加层：浮在窗口之上的全局浮层（搜索面板等），随窗口一起挂载/卸载 */
export type OverlayContribution = {
  apiVersion?: number
  id: string
  component: React.ComponentType<{ ctx: WorkbenchContext }>
}

export type StatusItem = {
  apiVersion?: number
  id: string
  order?: number
  render: (ctx: WorkbenchContext) => React.ReactNode
}

export type DocumentState = {
  activePath: string | null
  dirtyCount: number
  tabCount: number
}

type Listener = () => void

const listeners = { views: new Set<Listener>(), status: new Set<Listener>(), document: new Set<Listener>() }
const themeListeners = new Set<Listener>()
const probes = new Map<string, () => Promise<Record<string, unknown>> | Record<string, unknown>>()
const styleChunks: string[] = []
let styleElement: HTMLStyleElement | null = null

function flushStyles() {
  if (styleElement) styleElement.textContent = styleChunks.join('\n')
}
const versions = { views: 0, status: 0 }
const views: ViewContribution[] = []
const overlays: OverlayContribution[] = []
const statusItems: StatusItem[] = []

let documentState: DocumentState = { activePath: null, dirtyCount: 0, tabCount: 0 }
let fileOpener: ((path: string, options?: { name?: string }) => void) | null = null
let diffOpener: ((left: DiffSide, right: DiffSide) => void) | null = null

export type DiffSide = { path: string; name: string; text: string }

function bump(kind: 'views' | 'status') {
  versions[kind] += 1
  for (const listener of listeners[kind]) listener()
}

function acceptVersion(contribution: { apiVersion?: number; id?: string }): boolean {
  const version = contribution.apiVersion
  if (version === undefined || version === API_VERSION) return true
  console.warn(`[dsh-vscode-ide] 忽略贡献 ${contribution.id ?? '?'}：apiVersion=${version}，当前内核只支持 ${API_VERSION}`)
  return false
}

export const registry = {
  /* ── 视图 ── */
  registerView(contribution: ViewContribution): () => void {
    if (!acceptVersion(contribution)) return () => undefined
    if (!contribution || typeof contribution.id !== 'string' || !contribution.component) {
      console.warn('[dsh-vscode-ide] registerView 参数不合法，已忽略')
      return () => undefined
    }
    const existing = views.findIndex((item) => item.id === contribution.id)
    if (existing >= 0) views.splice(existing, 1)
    views.push(contribution)
    views.sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
    bump('views')
    return () => {
      const index = views.findIndex((item) => item.id === contribution.id)
      if (index >= 0) views.splice(index, 1)
      bump('views')
    }
  },
  /* ── 叠加层 ── */
  registerOverlay(contribution: OverlayContribution): () => void {
    if (!acceptVersion(contribution)) return () => undefined
    if (!contribution || typeof contribution.id !== 'string' || !contribution.component) {
      console.warn('[dsh-vscode-ide] registerOverlay 参数不合法，已忽略')
      return () => undefined
    }
    const existing = overlays.findIndex((item) => item.id === contribution.id)
    if (existing >= 0) overlays.splice(existing, 1)
    overlays.push(contribution)
    return () => {
      const index = overlays.findIndex((item) => item.id === contribution.id)
      if (index >= 0) overlays.splice(index, 1)
    }
  },
  getOverlays(): OverlayContribution[] {
    return [...overlays]
  },

  getViews(region: Region): ViewContribution[] {
    return views.filter((item) => item.region === region)
  },
  subscribeViews(listener: Listener): () => void {
    listeners.views.add(listener)
    return () => {
      listeners.views.delete(listener)
    }
  },
  getViewVersion(): number {
    return versions.views
  },

  /* ── 状态栏 ── */
  registerStatusItem(item: StatusItem): () => void {
    if (!acceptVersion(item)) return () => undefined
    const index = statusItems.findIndex((existing) => existing.id === item.id)
    if (index >= 0) statusItems.splice(index, 1)
    statusItems.push(item)
    statusItems.sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
    bump('status')
    return () => {
      const at = statusItems.findIndex((existing) => existing.id === item.id)
      if (at >= 0) statusItems.splice(at, 1)
      bump('status')
    }
  },
  getStatusItems(): StatusItem[] {
    return statusItems.slice()
  },
  subscribeStatus(listener: Listener): () => void {
    listeners.status.add(listener)
    return () => {
      listeners.status.delete(listener)
    }
  },
  getStatusVersion(): number {
    return versions.status
  },

  /* ── 样式：feature 把自己的 CSS 段交进来，内核统一注入一个 <style> ── */
  attachStyleElement(element: HTMLStyleElement | null) {
    styleElement = element
    flushStyles()
  },
  addStyles(css: string): () => void {
    if (typeof css !== 'string' || !css) return () => undefined
    styleChunks.push(css)
    flushStyles()
    return () => {
      const at = styleChunks.indexOf(css)
      if (at >= 0) styleChunks.splice(at, 1)
      flushStyles()
    }
  },

  /* ── 文档状态（由 editor feature 汇报，内核用来画标题栏） ── */
  setDocumentState(next: DocumentState) {
    const changed =
      next.activePath !== documentState.activePath ||
      next.dirtyCount !== documentState.dirtyCount ||
      next.tabCount !== documentState.tabCount
    documentState = next
    if (changed) for (const listener of listeners.document) listener()
  },
  getDocumentState(): DocumentState {
    return documentState
  },
  subscribeDocument(listener: Listener): () => void {
    listeners.document.add(listener)
    return () => {
      listeners.document.delete(listener)
    }
  },

  /* ── 环境探针扩展点：feature 可以把自己的诊断信息挂进 __dsv.probe() ── */
  registerProbe(id: string, run: () => Promise<Record<string, unknown>> | Record<string, unknown>): () => void {
    probes.set(id, run)
    return () => {
      probes.delete(id)
    }
  },
  getProbes(): Array<{ id: string; run: () => Promise<Record<string, unknown>> | Record<string, unknown> }> {
    return [...probes.entries()].map(([id, run]) => ({ id, run }))
  },

  /* ── 主题变更广播（由 app 触发，feature 监听） ── */
  subscribeTheme(listener: () => void): () => void {
    themeListeners.add(listener)
    return () => {
      themeListeners.delete(listener)
    }
  },
  emitThemeChanged() {
    for (const listener of themeListeners) listener()
  },

  /* ── 服务：打开文件 / 打开 diff（实现由 editor feature 注入） ── */
  setFileOpener(opener: (path: string, options?: { name?: string; line?: number }) => void) {
    fileOpener = opener
  },
  openFile(path: string, options?: { name?: string; line?: number }) {
    if (!fileOpener) {
      console.warn('[dsh-vscode-ide] 还没有编辑器可以打开文件')
      return
    }
    fileOpener(path, options)
  },
  setDiffOpener(opener: (left: DiffSide, right: DiffSide) => void) {
    diffOpener = opener
  },
  openDiff(left: DiffSide, right: DiffSide) {
    if (!diffOpener) {
      console.warn('[dsh-vscode-ide] 还没有编辑器可以打开 diff')
      return
    }
    diffOpener(left, right)
  }
}

/** ctx.vscodeIde 暴露给第三方插件的契约 */
export const publicApi = {
  apiVersion: API_VERSION,
  registerView: registry.registerView,
  registerStatusItem: registry.registerStatusItem,
  openFile: registry.openFile
}
