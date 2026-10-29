/**
 * 面包屑：当前文件路径的分段导航。
 * 点目录段 → 弹出该目录的兄弟项，可继续下钻或直接打开文件。
 */

import * as React from 'react'

import { h } from '../../h'
import { api, type Entry } from '../../kernel/transport'
import { workspace } from './monaco/workspace'

type Props = { path: string; cwd: string | null }

function splitPath(path: string, cwd: string | null): { label: string; dir: string }[] {
  const normalized = path.replace(/\\/g, '/')
  const cwdNorm = cwd ? cwd.replace(/\\/g, '/').replace(/\/+$/, '') : ''
  const inside = cwdNorm && normalized.toLowerCase().startsWith(cwdNorm.toLowerCase() + '/')
  const parts = (inside ? normalized.slice(cwdNorm.length + 1) : normalized).split('/').filter(Boolean)
  const segments: { label: string; dir: string }[] = []
  let current = inside ? cwdNorm : normalized.startsWith('/') ? '/' : ''
  for (const part of parts) {
    current = current === '/' ? `/${part}` : `${current}/${part}`
    segments.push({ label: part, dir: current })
  }
  return segments
}

export function Breadcrumbs({ path, cwd }: Props) {
  const [menu, setMenu] = React.useState<{ x: number; y: number; dir: string } | null>(null)
  const [entries, setEntries] = React.useState<Entry[]>([])
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [menu])

  React.useEffect(() => {
    if (!menu) return
    let alive = true
    setBusy(true)
    void api
      .list(menu.dir)
      .then((result) => {
        if (alive) setEntries(result.entries)
      })
      .catch(() => {
        if (alive) setEntries([])
      })
      .finally(() => {
        if (alive) setBusy(false)
      })
    return () => {
      alive = false
    }
  }, [menu])

  const segments = splitPath(path, cwd)
  if (segments.length === 0) return null

  const openMenu = (event: React.MouseEvent, dir: string) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, dir })
  }

  const openEntry = (entry: Entry) => {
    setMenu(null)
    if (entry.dir) {
      setMenu((previous) => (previous ? { ...previous, dir: entry.path } : null))
      return
    }
    void workspace.openEntry(entry, { preview: true })
  }

  return h(
    'div',
    { className: 'dsv-breadcrumbs' },
    segments.map((segment, index) => {
      const last = index === segments.length - 1
      return h(
        React.Fragment,
        { key: segment.dir },
        index > 0 ? h('span', { className: 'dsv-crumb-sep' }, '›') : null,
        h(
          'button',
          {
            className: 'dsv-crumb',
            'data-last': last ? 'true' : 'false',
            title: segment.dir,
            onClick: (event: React.MouseEvent) => {
              if (last) {
                void workspace.openEntry(
                  { path: segment.dir, name: segment.label, dir: false, size: 0, mtimeMs: 0 },
                  { preview: true }
                )
                return
              }
              openMenu(event, segment.dir)
            }
          },
          segment.label
        )
      )
    }),
    menu
      ? h(
          'div',
          {
            className: 'dsv-crumb-menu',
            style: { left: `${menu.x}px`, top: `${menu.y}px` },
            onPointerDown: (event: React.PointerEvent) => event.stopPropagation()
          },
          busy ? h('div', { className: 'dsv-crumb-empty' }, '加载中…') : null,
          !busy && entries.length === 0 ? h('div', { className: 'dsv-crumb-empty' }, '空目录') : null,
          entries.map((entry) =>
            h(
              'button',
              {
                key: entry.path,
                className: 'dsv-crumb-item',
                'data-dir': entry.dir ? 'true' : 'false',
                onClick: () => openEntry(entry)
              },
              `${entry.dir ? '▸' : '·'} ${entry.name}`
            )
          )
        )
      : null
  )
}
