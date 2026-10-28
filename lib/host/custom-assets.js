/**
 * 用户自定义资源导入（宿主侧）。
 *
 * 浏览器拿不到任意本地路径，所以由宿主按用户给的路径读文件：
 *   - 主题：VS Code 主题 JSON（colors + tokenColors）
 *   - 图标：VS Code 图标主题 JSON（material-icons.json 那一类）+ 同目录的 SVG
 *
 * 两条路都做了上限（大小 / 数量 / 总量），避免误选一个几百 MB 的文件把 DSH 卡死。
 * 这里不缓存任何内容：客户端只记路径，每次启动重新读（本地文件，几十毫秒）。
 */

import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, isAbsolute, resolve } from 'node:path'

const MAX_THEME_BYTES = 4 * 1024 * 1024
const MAX_ICON_JSON_BYTES = 8 * 1024 * 1024
const MAX_ICON_TOTAL_BYTES = 16 * 1024 * 1024
const MAX_ICON_COUNT = 2500
const MAX_TOKEN_RULES = 4000

function bad(message) {
  return Object.assign(new Error(message), { code: 'bad-argument' })
}

async function readJsonFile(filePath, maxBytes) {
  if (typeof filePath !== 'string' || !filePath.trim()) throw bad('请填写文件路径')
  const abs = isAbsolute(filePath) ? filePath : resolve(filePath)
  if (extname(abs).toLowerCase() !== '.json') throw bad('只支持 .json 文件')
  let info
  try {
    info = await stat(abs)
  } catch {
    throw bad(`文件不存在：${abs}`)
  }
  if (!info.isFile()) throw bad('路径不是文件')
  if (info.size > maxBytes) throw bad(`文件太大（${(info.size / 1048576).toFixed(1)} MB，上限 ${maxBytes / 1048576} MB）`)
  const raw = await readFile(abs, 'utf8')
  try {
    return { abs, json: JSON.parse(raw) }
  } catch (error) {
    throw bad(`JSON 解析失败：${error.message}`)
  }
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

/** 把 VS Code 的 tokenColors 转成 Monaco 的 rules（粗粒度映射：scope 直接当 token） */
function rulesFromTokenColors(tokenColors) {
  const rules = []
  if (!Array.isArray(tokenColors)) return rules
  for (const entry of tokenColors) {
    if (!entry || typeof entry !== 'object') continue
    const settings = entry.settings ?? {}
    const foreground = typeof settings.foreground === 'string' ? settings.foreground.replace('#', '') : undefined
    const fontStyle = typeof settings.fontStyle === 'string' ? settings.fontStyle : undefined
    if (!foreground && !fontStyle) continue
    const scopes = Array.isArray(entry.scope) ? entry.scope : typeof entry.scope === 'string' ? entry.scope.split(',') : []
    for (const scope of scopes) {
      const token = String(scope).trim().replace(/^\./, '')
      if (!token) continue
      rules.push({ token, foreground, fontStyle })
      if (rules.length >= MAX_TOKEN_RULES) return rules
    }
  }
  return rules
}

/** 导入 VS Code 主题 JSON */
export async function importTheme(filePath) {
  const { abs, json } = await readJsonFile(filePath, MAX_THEME_BYTES)
  if (!json || typeof json !== 'object') throw bad('不是有效的主题对象')
  const colors = json.colors
  if (!colors || typeof colors !== 'object') throw bad('这个 JSON 里没有 colors，不像是 VS Code 主题')

  const safeColors = {}
  for (const [key, value] of Object.entries(colors)) {
    if (typeof value === 'string' && HEX.test(value)) safeColors[key] = value
    if (Object.keys(safeColors).length >= 400) break
  }
  if (Object.keys(safeColors).length === 0) throw bad('colors 里没有可用的颜色值')

  const dark =
    typeof json.type === 'string'
      ? json.type === 'dark'
      : luminance(safeColors['editor.background'] ?? '#ffffff') < 0.5

  return {
    name: typeof json.name === 'string' && json.name.trim() ? json.name.trim() : '自定义主题',
    path: abs,
    type: dark ? 'dark' : 'light',
    colors: safeColors,
    rules: rulesFromTokenColors(json.tokenColors)
  }
}

function luminance(color) {
  const hex = color.replace('#', '')
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex.slice(0, 6)
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function symbolOf(id, svg) {
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 24 24'
  const inner = svg
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!inner) return ''
  return `<symbol id="dsv-mi-${id}" viewBox="${viewBox}">${inner}</symbol>`
}

/**
 * 导入图标主题：读 JSON 里 iconDefinitions 引用的每个 SVG，合成为一张 sprite。
 * 兼容 VS Code / Material Icon Theme 的标准格式（iconPath 相对 JSON 所在目录）。
 */
export async function importIconTheme(filePath) {
  const { abs, json } = await readJsonFile(filePath, MAX_ICON_JSON_BYTES)
  if (!json || typeof json !== 'object') throw bad('不是有效的图标主题')
  const definitions = json.iconDefinitions
  if (!definitions || typeof definitions !== 'object') throw bad('缺少 iconDefinitions，不像是 VS Code 图标主题')

  const fileNames = json.fileNames ?? {}
  const fileExtensions = json.fileExtensions ?? {}
  const folderNames = json.folderNames ?? {}
  const folderNamesExpanded = json.folderNamesExpanded ?? {}

  const used = new Set([
    json.file,
    json.folder,
    json.folderExpanded,
    ...Object.values(fileNames),
    ...Object.values(fileExtensions),
    ...Object.values(folderNames),
    ...Object.values(folderNamesExpanded)
  ])

  const baseDir = dirname(abs)
  const symbols = []
  let totalBytes = 0
  let missing = 0

  for (const id of used) {
    if (symbols.length >= MAX_ICON_COUNT) break
    const definition = definitions[id]
    if (!definition || typeof definition.iconPath !== 'string') continue
    const iconPath = definition.iconPath
    const svgPath = isAbsolute(iconPath) ? iconPath : resolve(baseDir, iconPath)
    try {
      const svg = await readFile(svgPath, 'utf8')
      totalBytes += svg.length
      if (totalBytes > MAX_ICON_TOTAL_BYTES) break
      const symbol = symbolOf(id, svg)
      if (symbol) symbols.push(symbol)
    } catch {
      missing += 1
    }
  }

  if (symbols.length === 0) throw bad('没有读到任何图标文件（iconPath 是否指向了不存在的 SVG？）')

  return {
    name: typeof json.name === 'string' && json.name.trim() ? json.name.trim() : '自定义图标',
    path: abs,
    icons: symbols.length,
    missing,
    sprite: `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">${symbols.join('')}</svg>`,
    mapping: {
      fileNames,
      fileExtensions,
      folderNames,
      folderNamesExpanded,
      defaults: {
        file: json.file ?? 'file',
        folder: json.folder ?? 'folder',
        folderExpanded: json.folderExpanded ?? 'folder'
      }
    }
  }
}
