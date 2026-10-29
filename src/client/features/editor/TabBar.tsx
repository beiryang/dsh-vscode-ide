/**
 * 编辑器区的标签条：文件名 + 脏标记 + 关闭按钮。
 * 支持拖拽排序、右键菜单（关闭其他 / 关闭右侧 / 关闭已保存）与预览标签（斜体）。
 */

import * as React from 'react'

import { h } from '../../h'
import { workspace, type WorkspaceTab } from './monaco/workspace'

function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

type MenuState = { x: number; y: number; key: string }

export function TabBar({ tabs, active }: { tabs: WorkspaceTab[]; active: string | null }) {
  const [menu, setMenu] = React.useState<MenuState | null>(null)
  const [dragKey, setDragKey] = React.useState<string | null>(null)
  const [dropIndex, setDropIndex] = React.useState<number | null>(null)

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

  if (tabs.length === 0) {
    return h('div', { className: 'dsv-tabbar' }, h('span', { className: 'dsv-tabbar-name' }, '欢迎'))
  }

  const current = tabs.find((tab) => tab.key === active)

  const openMenu = (event: React.MouseEvent, key: string) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, key })
  }

  return h(
    'div',
    { className: 'dsv-tabbar dsv-tabbar-tabs' },
    h(
      'div',
      { className: 'dsv-tabs' },
      tabs.map((tab, index) =>
        h(
          'div',
          {
            key: tab.key,
            className: 'dsv-tab',
            draggable: true,
            'data-active': tab.key === active ? 'true' : 'false',
            'data-preview': tab.preview ? 'true' : 'false',
            'data-drop': dropIndex === index ? 'true' : 'false',
            title: tab.path,
            onClick: () => workspace.activate(tab.key),
            onDoubleClick: () => workspace.pin(tab.key),
            onContextMenu: (event: React.MouseEvent) => openMenu(event, tab.key),
            onAuxClick: (event: React.MouseEvent) => {
              if (event.button === 1) workspace.close(tab.key)
            },
            onDragStart: (event: React.DragEvent) => {
              setDragKey(tab.key)
              try {
                event.dataTransfer.setData('text/plain', tab.key)
                event.dataTransfer.effectAllowed = 'move'
              } catch {
                /* ignore */
              }
            },
            onDragOver: (event: React.DragEvent) => {
              if (!dragKey || dragKey === tab.key) return
              event.preventDefault()
              setDropIndex(index)
            },
            onDragLeave: () => {
              if (dropIndex === index) setDropIndex(null)
            },
            onDrop: (event: React.DragEvent) => {
              event.preventDefault()
              const from = dragKey ?? event.dataTransfer.getData('text/plain')
              if (from) workspace.moveTab(from, index)
              setDragKey(null)
              setDropIndex(null)
            },
            onDragEnd: () => {
              setDragKey(null)
              setDropIndex(null)
            }
          },
          h('span', { className: 'dsv-tab-dot', 'data-dirty': tab.dirty ? 'true' : 'false' }),
          h('span', { className: 'dsv-tab-name' }, tab.name),
          tab.readOnly ? h('span', { className: 'dsv-tab-tag' }, '只读') : null,
          h(
            'button',
            {
              className: 'dsv-tab-close',
              title: '关闭',
              onClick: (event: React.MouseEvent) => {
                event.stopPropagation()
                workspace.close(tab.key)
              }
            },
            '✕'
          )
        )
      )
    ),
    current
      ? h(
          'div',
          { className: 'dsv-tab-meta' },
          current.dirty ? h('span', { className: 'dsv-tab-dirty' }, '未保存') : null,
          h('span', null, sizeText(current.size))
        )
      : null,
    menu
      ? h(
          'div',
          {
            className: 'dsv-tab-menu',
            style: { left: `${menu.x}px`, top: `${menu.y}px` },
            onPointerDown: (event: React.PointerEvent) => event.stopPropagation()
          },
          h(
            'button',
            { className: 'dsv-tab-menu-item', onClick: () => { workspace.close(menu.key); setMenu(null) } },
            '关闭'
          ),
          h(
            'button',
            { className: 'dsv-tab-menu-item', onClick: () => { workspace.closeOthers(menu.key); setMenu(null) } },
            '关闭其他'
          ),
          h(
            'button',
            { className: 'dsv-tab-menu-item', onClick: () => { workspace.closeRight(menu.key); setMenu(null) } },
            '关闭右侧'
          ),
          h(
            'button',
            { className: 'dsv-tab-menu-item', onClick: () => { workspace.closeSaved(); setMenu(null) } },
            '关闭已保存'
          ),
          h(
            'button',
            { className: 'dsv-tab-menu-item', onClick: () => { workspace.pin(menu.key); setMenu(null) } },
            '固定（取消预览）'
          )
        )
      : null
  )
}
