/**
 * 用户导入的图标主题（kernel 层状态，explorer 与设置页共用）。
 *
 * host 已经把「JSON + 同目录 SVG」合成为 sprite + mapping 了，这里只负责：
 *   - 注入 sprite（替换旧的）
 *   - 记录 mapping 供文件树查询
 *   - 把路径存进 localStorage，下次启动按路径重新读取（sprite 本身太大，不落盘）
 */

export type IconMapping = {
  fileNames: Record<string, string>
  fileExtensions: Record<string, string>
  folderNames: Record<string, string>
  folderNamesExpanded: Record<string, string>
  defaults: { file: string; folder: string; folderExpanded: string }
}

export type CustomIconsPayload = {
  sprite: string
  mapping: IconMapping
  name?: string
  path?: string
}

const KEY = 'dsv:icons.custom.v1'
const listeners = new Set<() => void>()
let mapping: IconMapping | null = null
let name: string | null = null
let path: string | null = null
let version = 0

function notify() {
  version += 1
  for (const listener of listeners) listener()
}

function injectSprite(sprite: string) {
  document.querySelector('[data-dsv-icons-custom]')?.remove()
  const holder = document.createElement('div')
  holder.setAttribute('data-dsv-icons-custom', '')
  holder.style.display = 'none'
  holder.innerHTML = sprite
  document.body.appendChild(holder)
}

export const customIcons = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getVersion(): number {
    return version
  },
  getMapping(): IconMapping | null {
    return mapping
  },
  getName(): string | null {
    return name
  },
  getPath(): string | null {
    return path
  },
  apply(payload: CustomIconsPayload) {
    injectSprite(payload.sprite)
    mapping = payload.mapping
    name = payload.name ?? '自定义图标'
    path = payload.path ?? path
    if (payload.path) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ path: payload.path, name: name }))
      } catch {
        /* ignore */
      }
    }
    notify()
  },
  clear() {
    mapping = null
    name = null
    path = null
    document.querySelector('[data-dsv-icons-custom]')?.remove()
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    notify()
  },
  /** 启动时按上次的路径重新读取（读不到就静默退回内置图标） */
  async restore(importer: (path: string) => Promise<CustomIconsPayload>) {
    let saved: { path?: string } | null = null
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    } catch {
      saved = null
    }
    if (!saved?.path) return
    try {
      const payload = await importer(saved.path)
      this.apply(payload)
    } catch (error) {
      console.warn('[dsh-vscode-ide] 自定义图标恢复失败（继续用内置图标）', error)
    }
  }
}
