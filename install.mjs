#!/usr/bin/env node
/**
 * 本地安装器（开发用）。
 *
 * 做的事情（全部幂等，改前先备份）：
 *   1. 把本包复制到 <profile>/node_modules/dsh-vscode-ide
 *   2. profile/package.json：dependencies 加一条 file: 指向本包；bundles 末尾追加包名
 *   3. profile/cordis.patch.yml：追加 insert 条目
 *
 * 用法：
 *   node install.mjs                  # 安装 / 更新
 *   node install.mjs --remove         # 卸载（保留 localStorage 里的用户数据）
 *   node install.mjs --profile <dir>  # 指定 profile 目录
 *
 * 注意：改完必须从托盘「退出」DSH 再打开 —— 客户端 bundle 只在启动时加载。
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = dirname(fileURLToPath(import.meta.url))
const PKG = 'dsh-vscode-ide'
const PATCH_ID = 'vscode-ide'

const args = process.argv.slice(2)
const remove = args.includes('--remove')
const profileFlag = args.indexOf('--profile')
let profile = resolve(
  profileFlag !== -1 && args[profileFlag + 1]
    ? args[profileFlag + 1]
    : process.env.DSH_HOME
      ? join(process.env.DSH_HOME, 'profiles', 'desktop')
      : 'A:\\Users\\Liu\\.dsh\\profiles\\desktop'
)

const log = (message) => console.log(`[${PKG}] ${message}`)
const fail = (message) => {
  console.error(`[${PKG}] ✗ ${message}`)
  process.exit(1)
}

/**
 * profile 被重命名过（比如 desktop → desktop-1，DSH 又新建了一个空的 desktop）时，
 * 默认路径会装进那个空 profile，装完看起来毫无变化。这里自动改投到真正装着本插件的那个。
 */
const hasPlugin = (dir) => existsSync(join(dir, 'node_modules', PKG, 'package.json'))
if (profileFlag === -1 && !hasPlugin(profile)) {
  try {
    const siblings = readdirSync(dirname(profile), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(dirname(profile), entry.name))
      .filter((dir) => hasPlugin(dir))
    if (siblings.length === 1) {
      log(`默认 profile 里没有本插件，自动改投到已有安装的 profile：${siblings[0]}`)
      profile = siblings[0]
    } else if (siblings.length > 1) {
      log(`发现多个装过本插件的 profile，请用 --profile 指定：${siblings.join(' | ')}`)
    }
  } catch {
    /* 读不到同级别目录就按默认走 */
  }
}

function backup(file) {
  if (!existsSync(file)) return undefined
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const target = `${file}.bak-${stamp}`
  cpSync(file, target)
  return target
}

if (!existsSync(join(profile, 'package.json'))) fail(`profile 目录不对：${profile}（找不到 package.json）`)

const pkgJsonPath = join(profile, 'package.json')
const patchPath = join(profile, 'cordis.patch.yml')
const targetDir = join(profile, 'node_modules', PKG)

/* ── 卸载 ── */
if (remove) {
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true })
    log(`已删除 ${targetDir}`)
  }
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  if (pkgJson.dependencies && pkgJson.dependencies[PKG]) {
    backup(pkgJsonPath)
    delete pkgJson.dependencies[PKG]
    const bundles = pkgJson.dsh?.profile?.bundles
    if (Array.isArray(bundles)) pkgJson.dsh.profile.bundles = bundles.filter((item) => item !== PKG)
    writeFileSync(pkgJsonPath, `${JSON.stringify(pkgJson, null, 2)}\n`, 'utf8')
    log('已从 profile/package.json 移除依赖与 bundle 条目')
  }
  if (existsSync(patchPath)) {
    const text = readFileSync(patchPath, 'utf8')
    if (text.includes(PKG)) {
      backup(patchPath)
      const cleaned = text.replace(new RegExp(`\\n?- id: ${PATCH_ID}\\n\\s+name: ['"]${PKG}['"]\\n?`, 'g'), '\n')
      writeFileSync(patchPath, cleaned, 'utf8')
      log('已从 cordis.patch.yml 移除条目')
    }
  }
  log('卸载完成，完全退出 DSH Desktop 再打开生效。')
  process.exit(0)
}

/* ── 安装 ── */
log(`源目录：${SRC}`)
log(`profile：${profile}`)

if (!existsSync(join(SRC, 'lib', 'client.js'))) fail('源目录里缺 lib/client.js，请先跑 node scripts/build-client.mjs')
if (!existsSync(join(SRC, 'lib', 'index.js'))) fail('源目录里缺 lib/index.js，安装包不完整')

if (existsSync(targetDir)) {
  // DSH 运行时可能锁住已加载的 .node（node-pty），删除会 EPERM；
  // 删不掉就退化为覆盖安装，避免把插件目录删到一半。
  try {
    rmSync(targetDir, { recursive: true, force: true })
    log(`清掉旧版本 ${targetDir}`)
  } catch {
    log('旧版本目录被占用，改为覆盖安装（建议先托盘退出 DSH）')
  }
}
mkdirSync(targetDir, { recursive: true })
for (const entry of [
  'package.json',
  'cordis.patch.yml',
  'README.md',
  'README.zh.md',
  'CHANGELOG.md',
  'THIRD-PARTY.md',
  'LICENSE',
  'docs',
  'lib',
  'vendor'
]) {
  const from = join(SRC, entry)
  if (!existsSync(from)) continue
  cpSync(from, join(targetDir, entry), { recursive: statSync(from).isDirectory() })
}
log(`已复制到 ${targetDir}`)

/* 运行期依赖（目前只有 node-pty）：npm 安装时会自动装，本地脚本复制时需要手动带过去 */
{
  const own = JSON.parse(readFileSync(join(SRC, 'package.json'), 'utf8'))
  const deps = [...Object.keys(own.dependencies ?? {}), ...Object.keys(own.optionalDependencies ?? {})]
  for (const name of deps) {
    const from = join(SRC, 'node_modules', name)
    if (!existsSync(from)) {
      log(`⚠ 缺运行期依赖 ${name}（先在源目录 npm install）`)
      continue
    }
    const to = join(targetDir, 'node_modules', name)
    // 已存在就跳过：覆盖写入正在被 DSH 映射的 .node 会 EPERM
    if (existsSync(join(to, 'package.json'))) continue
    mkdirSync(dirname(to), { recursive: true })
    cpSync(from, to, { recursive: true })
  }
  if (deps.length > 0) log(`已带运行期依赖：${deps.join(', ')}`)
}

/* profile/package.json */
{
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  let changed = false

  pkgJson.dependencies = pkgJson.dependencies || {}
  const rel = relative(profile, SRC).replace(/\\/g, '/')
  const fileSpec = /^[A-Za-z]:/.test(rel) || rel.startsWith('/') ? `file:///${rel.replace(/^\/+/, '')}` : `file:${rel}`
  if (pkgJson.dependencies[PKG] !== fileSpec) {
    pkgJson.dependencies[PKG] = fileSpec
    changed = true
  }

  const profileCfg = (pkgJson.dsh = pkgJson.dsh || {})
  profileCfg.profile = profileCfg.profile || {}
  const bundles = Array.isArray(profileCfg.profile.bundles) ? profileCfg.profile.bundles : []
  if (!bundles.includes(PKG)) {
    bundles.push(PKG)
    changed = true
  }
  profileCfg.profile.bundles = bundles

  if (changed) {
    backup(pkgJsonPath)
    writeFileSync(pkgJsonPath, `${JSON.stringify(pkgJson, null, 2)}\n`, 'utf8')
    log(`已更新 profile/package.json（dependency=${fileSpec}，bundles 共 ${bundles.length} 项）`)
  } else {
    log('profile/package.json 已是目标状态，跳过')
  }
}

/* cordis.patch.yml */
{
  const text = existsSync(patchPath) ? readFileSync(patchPath, 'utf8') : ''
  if (text.includes(PKG)) {
    log('cordis.patch.yml 已有条目，跳过')
  } else {
    backup(patchPath)
    const block = ['', `# ${PKG}：VS Code 式工作台（壳自挂 + 插槽入口）`, '- insert:', `    - id: ${PATCH_ID}`, `      name: '${PKG}'`].join('\n')
    writeFileSync(patchPath, `${text.replace(/\s*$/, '')}\n${block}\n`, 'utf8')
    log('已把 insert 条目追加到 cordis.patch.yml')
  }
}

log('安装完成 ✅')
log('下一步：完全退出 DSH Desktop（托盘图标 → 退出），再重新打开。')
log('打开后：左侧栏「IDE」→「打开工作台」，或按 Ctrl+Alt+I；控制台可跑 await __dsv.probe()。')
log('改配置前建议先留快照：node B:\\Coding\\workbench\\dsh-float\\profile-guard.mjs snapshot')
