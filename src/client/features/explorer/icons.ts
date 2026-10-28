/**
 * Material Icon Theme 的运行时接入（懒加载）。
 *
 * 图标数据是 1.2 MB 的静态资源，放在 vendor/icons/icons.js，由宿主按
 * /dsh-vscode-ide/assets/icons/icons.js 提供；只有第一次渲染文件树时才加载，
 * 所以不影响主 bundle 体积。
 *
 * 数据格式由 scripts/build-icons.mjs 生成：
 *   SPRITE  —— 一个隐藏的 <svg>，里面是全部 <symbol id="dsv-mi-<id>">
 *   MAPPING —— 文件名 / 扩展名 / 文件夹名 → 图标 id
 */

import { BASE } from '../../kernel/transport'
import { customIcons } from '../../kernel/custom-icons'

type IconMapping = {
  fileNames: Record<string, string>
  fileExtensions: Record<string, string>
  folderNames: Record<string, string>
  folderNamesExpanded: Record<string, string>
  defaults: { file: string; folder: string; folderExpanded: string }
}

let mapping: IconMapping | null = null
let spriteInjected = false
let loading: Promise<void> | null = null
let version = 0
const listeners = new Set<() => void>()

function notify() {
  version += 1
  for (const listener of listeners) listener()
}

// 自定义图标切换时也让文件树重渲染
customIcons.subscribe(notify)

export function iconsVersion(): number {
  return version
}

export function iconsReady(): boolean {
  return mapping !== null
}

export function subscribeIcons(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function loadIcons(): Promise<void> {
  if (loading) return loading
  const url = `${BASE}/assets/icons/icons.js`
  loading = import(/* @vite-ignore */ url)
    .then((module: { SPRITE: string; MAPPING: IconMapping }) => {
      if (!spriteInjected) {
        const holder = document.createElement('div')
        holder.setAttribute('data-dsv-icons', '')
        holder.style.display = 'none'
        holder.innerHTML = module.SPRITE
        document.body.appendChild(holder)
        spriteInjected = true
      }
      mapping = module.MAPPING
      notify()
    })
    .catch((error) => {
      console.warn('[dsh-vscode-ide] 图标资源加载失败（文件树会退化成纯文字）', error)
    })
  return loading
}

/** 文件名 → 图标 id（返回 symbol 的 id，不含 #） */
export function iconId(name: string, dir: boolean, expanded: boolean): string | null {
  // 用户导入的图标主题优先；否则用内置的 Material
  const map = customIcons.getMapping() ?? mapping
  if (!map) return null
  if (dir) {
    const collapsed = map.folderNames[name]
    const opened = map.folderNamesExpanded[name]
    const id = (expanded ? opened : collapsed) ?? collapsed ?? (expanded ? map.defaults.folderExpanded : map.defaults.folder)
    return `dsv-mi-${id}`
  }
  const exact = map.fileNames[name]
  if (exact) return `dsv-mi-${exact}`
  // 扩展名匹配：从最长的组合开始试（a.spec.ts → spec.ts → ts）
  const parts = name.split('.')
  for (let index = 1; index < parts.length; index += 1) {
    const ext = parts.slice(index).join('.').toLowerCase()
    const hit = map.fileExtensions[ext]
    if (hit) return `dsv-mi-${hit}`
  }
  return `dsv-mi-${map.defaults.file}`
}
