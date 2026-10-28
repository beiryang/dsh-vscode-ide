#!/usr/bin/env node
/**
 * 把 ssh2 及其全部运行时依赖复制进 vendor/node_modules。
 *
 * 为什么要 vendor：开发期 install.mjs 是「整包复制」而不是走 pnpm，
 * profile 里不会有 ssh2；发布到市场时虽然会按 dependencies 安装，
 * 但自带的这份副本能让插件在两种安装方式下都开箱可用。
 *
 * 依赖是手工维护的（ssh2 的依赖树很小，且都是纯 JS），脚本会校验
 * 每一项都能真正被 import，缺依赖会直接失败而不是等到运行时才炸。
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const nodeModules = join(root, 'node_modules')
const target = join(root, 'vendor', 'node_modules')

// ssh2@1.17 的完整运行时依赖树（optional 的 cpu-features 不需要）
const PACKAGES = ['ssh2', 'asn1', 'bcrypt-pbkdf', 'tweetnacl', 'safer-buffer']

mkdirSync(target, { recursive: true })

for (const name of PACKAGES) {
  const from = join(nodeModules, name)
  const to = join(target, name)
  if (!existsSync(from)) {
    console.error(`[vendor-ssh2] 缺少依赖：${name}（先跑 npm install）`)
    process.exit(1)
  }
  rmSync(to, { recursive: true, force: true })
  cpSync(from, to, { recursive: true })
}

// 从 vendor 目录里真正 import 一次，确保依赖解析完整
const entry = pathToFileURL(join(target, 'ssh2', 'lib', 'index.js')).href
try {
  const ssh2 = await import(entry)
  if (typeof ssh2.Client !== 'function') throw new Error('ssh2.Client 不存在')
} catch (error) {
  console.error(`[vendor-ssh2] 自检失败：${error.message}`)
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(join(target, 'ssh2', 'package.json'), 'utf8'))
console.log(`[vendor-ssh2] 已复制 ${PACKAGES.length} 个包（ssh2 ${pkg.version}），import 自检通过`)
