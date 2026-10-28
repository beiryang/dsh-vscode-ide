#!/usr/bin/env node
/**
 * 构建图标资源：把 Material Icon Theme（MIT）压成两个东西
 *   1. 一张内联 sprite（<symbol> 集合），一次注入 DOM，按 id 复用
 *   2. 一份映射表（文件名 / 扩展名 / 文件夹名 → 图标 id）
 *
 * 产物写到 vendor/icons/icons.js，由 explorer 在首次渲染文件树时懒加载，
 * 不进主 bundle（否则主包会从 144 KB 涨到 1.4 MB）。
 *
 * 来源：https://github.com/material-extensions/vscode-material-icon-theme (MIT)
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkgDir = join(root, 'node_modules', 'material-icon-theme')
const themePath = join(pkgDir, 'dist', 'material-icons.json')

let theme
try {
  theme = JSON.parse(readFileSync(themePath, 'utf8'))
} catch (error) {
  console.error(`[icons] 找不到图标主题：${themePath}（先 npm install）`)
  process.exit(1)
}

const definitions = theme.iconDefinitions ?? {}
const folderNames = theme.folderNames ?? {}
const folderNamesExpanded = theme.folderNamesExpanded ?? {}

/** 被映射表引用到的图标 id */
const used = new Set([
  theme.file,
  theme.folder,
  theme.folderExpanded,
  ...Object.values(theme.fileNames ?? {}),
  ...Object.values(theme.fileExtensions ?? {}),
  ...Object.values(folderNames),
  ...Object.values(folderNamesExpanded)
])

function symbolOf(id) {
  const definition = definitions[id]
  if (!definition || typeof definition.iconPath !== 'string') return ''
  const relative = definition.iconPath.replace(/^\.\/\.\.\//, '')
  let svg
  try {
    svg = readFileSync(join(pkgDir, relative), 'utf8')
  } catch {
    return ''
  }
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 24 24'
  const inner = svg
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return `<symbol id="dsv-mi-${id}" viewBox="${viewBox}">${inner}</symbol>`
}

const symbols = []
let skipped = 0
for (const id of used) {
  const symbol = symbolOf(id)
  if (symbol) symbols.push(symbol)
  else skipped += 1
}

const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">${symbols.join('')}</svg>`

const mapping = {
  fileNames: theme.fileNames ?? {},
  fileExtensions: theme.fileExtensions ?? {},
  folderNames,
  folderNamesExpanded,
  defaults: {
    file: theme.file,
    folder: theme.folder,
    folderExpanded: theme.folderExpanded
  }
}

const outDir = join(root, 'vendor', 'icons')
mkdirSync(outDir, { recursive: true })
const out = join(outDir, 'icons.js')
const source = [
  '// 由 scripts/build-icons.mjs 生成，勿手改。',
  '// 图标来自 Material Icon Theme (MIT) https://github.com/material-extensions/vscode-material-icon-theme',
  `export const SPRITE = ${JSON.stringify(sprite)}`,
  `export const MAPPING = ${JSON.stringify(mapping)}`,
  ''
].join('\n')
writeFileSync(out, source, 'utf8')

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`
console.log(
  `[icons] ${symbols.length} 个图标（跳过 ${skipped}）→ vendor/icons/icons.js ${kb(Buffer.byteLength(source))}` +
    `（sprite ${kb(Buffer.byteLength(sprite))}，映射 ${kb(Buffer.byteLength(JSON.stringify(mapping)))}）`
)
