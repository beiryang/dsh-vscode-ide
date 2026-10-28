#!/usr/bin/env node
/**
 * 把 xterm.js 打成插件自带的 ESM 静态资源（和 Monaco 一个思路：
 * 不进客户端 bundle，用到终端时才 `import()`）。
 */

import { build } from 'esbuild'
import { copyFileSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outdir = join(root, 'vendor', 'xterm')

rmSync(outdir, { recursive: true, force: true })
mkdirSync(outdir, { recursive: true })

await build({
  entryPoints: [join(root, 'scripts', 'xterm-entry.js')],
  outdir,
  entryNames: 'xterm',
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['chrome110'],
  legalComments: 'none',
  logLevel: 'warning'
})

copyFileSync(join(root, 'node_modules', '@xterm', 'xterm', 'css', 'xterm.css'), join(outdir, 'xterm.css'))

const js = statSync(join(outdir, 'xterm.js')).size
const css = statSync(join(outdir, 'xterm.css')).size
console.log(`[xterm] 已生成 xterm.js ${(js / 1024).toFixed(0)} KB + xterm.css ${(css / 1024).toFixed(0)} KB`)
