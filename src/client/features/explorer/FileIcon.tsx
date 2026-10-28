/** 文件/文件夹图标：渲染 vendor/icons 里的 sprite 符号。 */

import * as React from 'react'

import { h } from '../../h'
import { iconId, iconsVersion, subscribeIcons } from './icons'

export function FileIcon({ name, dir, expanded }: { name: string; dir: boolean; expanded: boolean }) {
  // 图标资源加载完成后重渲染一次
  React.useSyncExternalStore(subscribeIcons, iconsVersion)

  const id = iconId(name, dir, expanded)
  if (!id) return h('span', { className: 'dsv-file-icon', 'data-placeholder': 'true' })
  return h('svg', { className: 'dsv-file-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('use', { href: `#${id}` }))
}
