#!/usr/bin/env node
/**
 * 产物冒烟测试：不启动 DSH，直接把 lib/client.js 的工厂函数跑一遍。
 *
 * 能抓到的错误：
 *   - bundle 外层包装写错（没有导出 apply / inject）
 *   - 模块顶层访问了浏览器 API 而 DSH 那边顺序不同（这里用最小 stub 顶住）
 *   - externals 漏标（多 require 了 DSH 不提供的包）
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const code = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

const storage = new Map()
const listeners = new Map()

globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
}

globalThis.window = {
  innerWidth: 1440,
  innerHeight: 900,
  __ModuleLoader__: { load: (entry) => (globalThis.__captured = entry) },
  addEventListener: () => {},
  removeEventListener: () => {},
  setTimeout,
  clearTimeout,
  setInterval: () => 0,
  clearInterval: () => {},
  matchMedia: () => ({ addEventListener: () => {}, removeEventListener: () => {} })
}
globalThis.document = { body: {}, head: {}, createElement: () => ({}), querySelector: () => null }

// 执行 bundle 顶层：注册工厂
const call = new Function('window', 'document', 'localStorage', code)
call(globalThis.window, globalThis.document, globalThis.localStorage)

const entry = globalThis.__captured
if (!entry || entry.id !== 'dsh-vscode-ide' || typeof entry.factory !== 'function') {
  console.error('✗ 没有捕获到 __ModuleLoader__.load 调用')
  process.exit(1)
}

/**
 * 最小 React 替身：冒烟测试只执行「模块顶层 + 组件定义」，
 * 不真正渲染，所以用桩就够了，不必为此引入 react 依赖。
 */
const createElement = () => ({})
const React = {
  createElement,
  Fragment: Symbol.for('react.fragment'),
  Component: class Component {
    constructor(props) {
      this.props = props
      this.state = {}
    }
    setState() {}
  },
  useState: () => [undefined, () => {}],
  useRef: () => ({ current: null }),
  useEffect: () => {},
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useSyncExternalStore: () => '',
  default: { createElement }
}
const fakeRoot = { render() {}, unmount() {} }
const required = []

const moduleExports = entry.factory((name) => {
  required.push(name)
  if (name === 'react') return React
  if (name === 'react-dom/client') return { createRoot: () => fakeRoot }
  if (name === 'react-dom') return {}
  throw new Error(`unexpected external: ${name}`)
})

const problems = []
if (typeof moduleExports.apply !== 'function') problems.push('缺少导出 apply')
if (!Array.isArray(moduleExports.inject)) problems.push('缺少导出 inject')
for (const name of required) {
  if (!['react', 'react-dom', 'react-dom/client'].includes(name)) problems.push(`多余的外置依赖: ${name}`)
}

if (problems.length > 0) {
  console.error('✗ 冒烟失败：')
  for (const problem of problems) console.error('  - ' + problem)
  process.exit(1)
}

console.log(`✓ 冒烟通过：apply/inject 都在，外置依赖 ${[...new Set(required)].join(', ')}`)
