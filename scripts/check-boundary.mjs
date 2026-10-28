#!/usr/bin/env node
/**
 * 内核边界检查：src/client/kernel/** 不允许 import features / assemble / dsh。
 *
 * 规则很简单，但必须在 CI / build 前跑：一旦内核反向依赖 feature，
 * 「把 kernel 提成独立包」这件事就做不成了。
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const client = join(root, 'src', 'client')
const kernel = join(client, 'kernel')

const FORBIDDEN = ['features', 'assemble', 'dsh']

const walk = (dir) => {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full)
  }
  return out
}

const IMPORT_RE = /(?:from\s+|import\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)\1/g
const violations = []

for (const file of walk(kernel)) {
  const code = readFileSync(file, 'utf8')
  for (const match of code.matchAll(IMPORT_RE)) {
    const target = relative(client, resolve(dirname(file), match[2])).replace(/\\/g, '/')
    const hit = FORBIDDEN.find((prefix) => target === prefix || target.startsWith(`${prefix}/`))
    if (hit) {
      violations.push(`${relative(client, file).replace(/\\/g, '/')}  →  ${match[2]}（越界到 ${hit}）`)
    }
  }
}

if (violations.length) {
  console.error('[boundary] 内核越界了：')
  for (const item of violations) console.error('  ' + item)
  process.exit(1)
}

console.log('[boundary] 内核边界 OK：kernel 未 import 任何 feature')
