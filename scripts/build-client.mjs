#!/usr/bin/env node
/**
 * 把 src/client 打成 DSH 认的客户端 bundle。
 *
 * DSH 的客户端插件产物长这样：
 *
 *   window.__ModuleLoader__.load({
 *     id: '<包名>',
 *     factory: (require) => { var module = {exports:{}}; ... return module.exports }
 *   })
 *
 * 也就是「CJS 模块体 + 外层包一层的工厂函数」，react / react-dom 由加载器提供，
 * 所以必须标成 external，不能打进包体。
 */

import { build } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const outfile = join(root, 'lib', 'client.js')

mkdirSync(join(root, 'lib'), { recursive: true })

await build({
  entryPoints: [join(root, 'src', 'client', 'index.tsx')],
  outfile,
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome110'],
  jsx: 'transform',
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  external: ['react', 'react-dom', 'react-dom/client'],
  define: { __DSV_VERSION__: JSON.stringify(pkg.version) },
  legalComments: 'none',
  sourcemap: false,
  logLevel: 'warning',
  charset: 'utf8'
})

const body = readFileSync(outfile, 'utf8')
const wrapped = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${body}
    return module.exports;
  }
});
`
writeFileSync(outfile, wrapped, 'utf8')

const kb = (Buffer.byteLength(wrapped, 'utf8') / 1024).toFixed(1)
console.log(`[dsh-vscode-ide] 客户端 bundle 已生成：lib/client.js（${kb} KB，externals: react / react-dom/client）`)
