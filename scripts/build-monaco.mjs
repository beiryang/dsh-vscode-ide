#!/usr/bin/env node
/**
 * 把 monaco-editor 的 ESM 源码打成插件自带的静态资源。
 *
 * 为什么要走 ESM 而不是 AMD：
 *   页面里已经存在一个带 `.amd` 的 `define`（DSH 或其它插件留下的），
 *   Monaco 的 AMD loader 检测到后会**跳过初始化**，于是 `window.require`
 *   不是它的，require() 出去就永远不回调 —— 这正是之前 15s 超时的原因。
 *   ESM 走 `import(url)`，完全不碰全局 define/require，谁先定义都不影响。
 *
 * 产物（vendor/monaco/esm/）：
 *   monaco.js          编辑器 + 语言（一个文件，按需加载）
 *   monaco.css         编辑器样式（需要单独 <link>）
 *   workers/*.worker.js 语言服务 worker
 *   assets/*           字体等
 */

import { build } from 'esbuild'
import { existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const monacoEsm = join(root, 'node_modules', 'monaco-editor', 'esm', 'vs')
const outdir = join(root, 'vendor', 'monaco', 'esm')

if (!existsSync(monacoEsm)) {
  console.error('[monaco] 找不到 node_modules/monaco-editor，先跑 npm install')
  process.exit(1)
}

rmSync(outdir, { recursive: true, force: true })

const shared = {
  bundle: true,
  minify: true,
  target: ['chrome110'],
  legalComments: 'none',
  logLevel: 'warning',
  loader: { '.ttf': 'file', '.svg': 'file', '.png': 'file' }
}

await build({
  ...shared,
  entryPoints: { monaco: join(monacoEsm, 'editor', 'editor.main.js') },
  outdir,
  format: 'esm',
  entryNames: '[name]',
  assetNames: 'assets/[name]-[hash]'
})

const workers = {
  'editor.worker': 'editor/editor.worker.js',
  'ts.worker': 'language/typescript/ts.worker.js',
  'json.worker': 'language/json/json.worker.js',
  'css.worker': 'language/css/css.worker.js',
  'html.worker': 'language/html/html.worker.js'
}

const entries = {}
for (const [name, file] of Object.entries(workers)) entries[name] = join(monacoEsm, ...file.split('/'))

await build({
  ...shared,
  entryPoints: entries,
  outdir: join(outdir, 'workers'),
  format: 'iife',
  entryNames: '[name]'
})

const { readdirSync, statSync } = await import('node:fs')
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
  )
const files = walk(outdir)
const total = files.reduce((sum, file) => sum + statSync(file).size, 0)
console.log(`[monaco] 已生成 ${files.length} 个文件，合计 ${(total / 1024 / 1024).toFixed(1)} MB → vendor/monaco/esm`)
