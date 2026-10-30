/**
 * 远程工作区外观增强：在 DSH 左侧栏的工作区行图标上加一个地球角标。
 *
 * 只做「追加角标」这种可逆的 DOM 装饰：
 *   - 行键 `data-row-key="workspace:<原生 id>"` 与远程工作区的 shellWorkspaceId 对齐
 *   - 远程 id 集合每 15 秒刷新一次；行消失/不再是远程时移除角标（自愈）
 *   - 不改变标题文本，避免和 React 的文本 diff 打架
 */

import { remoteApi } from './api'

const GLOBE_ATTR = 'data-dsv-ws-globe'
const HOST_ATTR = 'data-dsv-ws-globe-host'

type RemoteWorkspace = { id: string; shellWorkspaceId?: string; remotePath?: string }

function makeGlobe(): HTMLElement {
  const badge = document.createElement('span')
  badge.className = 'dsv-ws-globe'
  badge.setAttribute(GLOBE_ATTR, '1')
  badge.title = '远程工作区'
  badge.innerHTML =
    '<svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">' +
    '<circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<path d="M1 6h10M6 1v10M2.6 3.4c2 1.4 4.8 1.4 6.8 0M2.6 8.6c2-1.4 4.8-1.4 6.8 0" fill="none" stroke="currentColor" stroke-width="0.9"/>' +
    '</svg>'
  return badge
}

function iconHostOfRow(row: Element): HTMLElement | null {
  const first = row.children && row.children[0]
  if (!first || !(first instanceof HTMLElement)) return null
  if (!first.querySelector('svg')) return null
  return first
}

function decorate(row: Element, remoteIds: Set<string>) {
  const key = row.getAttribute('data-row-key') || ''
  if (!key.startsWith('workspace:')) return
  const id = key.slice('workspace:'.length)
  const want = remoteIds.has(id)
  const existing = row.querySelector(`[${GLOBE_ATTR}]`)
  if (!want) {
    if (existing) existing.remove()
    return
  }
  if (existing) return
  const host = iconHostOfRow(row)
  if (!host) return
  if (host.getAttribute(HOST_ATTR) !== '1') {
    host.setAttribute(HOST_ATTR, '1')
    if (getComputedStyle(host).position === 'static') {
      host.style.position = 'relative'
      host.setAttribute('data-dsv-ws-globe-positioned', '1')
    }
  }
  host.appendChild(makeGlobe())
}

export function installRemoteWorkspaceAppearance(): () => void {
  let disposed = false
  let remoteIds = new Set<string>()
  let timer: number | null = null

  const decorateAll = () => {
    if (disposed) return
    for (const row of Array.from(document.querySelectorAll('[data-row-key^="workspace:"]'))) {
      decorate(row, remoteIds)
    }
  }

  const refresh = async () => {
    if (disposed) return
    const result = await remoteApi<{ workspaces: RemoteWorkspace[] }>('listWorkspaces', undefined, 10000)
    if (disposed) return
    const next = new Set<string>()
    if (result.ok) {
      for (const workspace of result.value.workspaces ?? []) {
        if (workspace.shellWorkspaceId) next.add(workspace.shellWorkspaceId)
      }
    }
    remoteIds = next
    decorateAll()
  }

  void refresh()
  timer = window.setInterval(() => void refresh(), 15000)

  const observer = new MutationObserver(() => decorateAll())
  observer.observe(document.body, { childList: true, subtree: true })

  return () => {
    disposed = true
    observer.disconnect()
    if (timer !== null) window.clearInterval(timer)
    for (const badge of Array.from(document.querySelectorAll(`[${GLOBE_ATTR}]`))) badge.remove()
    for (const host of Array.from(document.querySelectorAll(`[${HOST_ATTR}="1"]`))) {
      host.removeAttribute(HOST_ATTR)
      if (host.getAttribute('data-dsv-ws-globe-positioned') === '1') {
        ;(host as HTMLElement).style.position = ''
        host.removeAttribute('data-dsv-ws-globe-positioned')
      }
    }
  }
}
