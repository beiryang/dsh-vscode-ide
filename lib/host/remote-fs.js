/**
 * 远程工作区的文件访问（SFTP）。
 *
 * 背景：远程工作区会话的 cwd 是本地镜像目录，但 dsh-remote-ssh 是「直连远端」的，
 * 镜像里可能根本没有文件。所以这里给文件树/编辑器/快速打开补一条 SFTP 后路：
 * 本地路径（镜像形状）↔ 远端路径（POSIX）双向翻译，其余接口形状与本地完全一致。
 *
 * 连接信息复用终端那套：~/.dsh/remote-workspaces/<id>/.remote-ssh.json
 */

import { posix as rpath, join as ljoin, dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { remoteMetaForCwd } from './terminal.js'

const READ_LIMIT = 2 * 1024 * 1024
const SEARCH_LIMIT = 800
const SEARCH_DEPTH = 8
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', '.idea', '.vscode',
  'dist', 'build', 'out', 'target', 'vendor', 'coverage', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', '.cache', '.turbo', 'tmp', 'temp'
])

const pool = new Map()

function expandRemote(path, user) {
  if (!path || path === '~') return `/home/${user || 'root'}`
  if (path.startsWith('~/')) return `/home/${user || 'root'}${path.slice(1)}`
  return path
}

async function loadSsh2() {
  try {
    return await import('ssh2')
  } catch {
    const here = dirname(fileURLToPath(import.meta.url))
    const vendored = join(here, '..', '..', 'vendor', 'node_modules', 'ssh2', 'lib', 'index.js')
    return import(pathToFileURL(vendored).href)
  }
}

/** 读取 Code Space 远程连接配置（宿主侧文件版设置） */
function loadRemoteProfiles() {
  try {
    const raw = readFileSync(join(homedir(), '.dsh', 'code-space-remote.json'), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed && parsed.profiles) ? parsed.profiles : []
  } catch {
    return []
  }
}

/**
 * 解析一个远程工作区可用的凭据：
 *   - .remote-ssh.json 里没有 keyPath 时，回落到连接配置里的 keyPath
 *   - 仍没有就依次尝试 ~/.ssh/id_ed25519 / id_ecdsa / id_rsa（和 ssh 命令的默认行为一致）
 *   - 密码认证的连接使用配置里的 password
 */
function resolveAuth(meta) {
  const profiles = loadRemoteProfiles()
  const profile =
    profiles.find((item) => item && item.id === meta.profileId) ||
    profiles.find((item) => item && item.host === meta.host && item.user === meta.user) ||
    null
  const proxyJump = (profile && profile.proxyJump) || meta.proxyJump || ''
  const password = profile && profile.authMethod === 'password' ? String(profile.password || '') : ''
  let privateKey = null
  let keyPath = meta.keyPath || (profile && profile.keyPath) || ''
  if (!password) {
    const candidates = [
      keyPath,
      join(homedir(), '.ssh', 'id_ed25519'),
      join(homedir(), '.ssh', 'id_ecdsa'),
      join(homedir(), '.ssh', 'id_rsa')
    ]
    for (const candidate of candidates) {
      if (!candidate) continue
      try {
        privateKey = readFileSync(expandLocal(candidate))
        keyPath = candidate
        break
      } catch {
        /* 试下一个 */
      }
    }
  }
  return { privateKey, password, keyPath, proxyJump }
}

function connectSftp(meta) {
  const auth = resolveAuth(meta)
  const key = `${meta.host}:${meta.port}:${meta.user}:${auth.keyPath}:${auth.password ? 'pw' : 'key'}`
  const cached = pool.get(key)
  if (cached) return cached.promise

  const promise = (async () => {
    const ssh2 = await loadSsh2()
    const client = new ssh2.Client()
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('SSH 连接超时（20s）')), 20000)
      client.once('ready', () => {
        clearTimeout(timer)
        resolve()
      })
      client.once('error', (error) => {
        clearTimeout(timer)
        reject(new Error(`SSH 连接失败：${error.message}`))
      })
      const config = {
        host: meta.host,
        port: meta.port,
        username: meta.user,
        readyTimeout: 20000,
        keepaliveInterval: 20000
      }
      if (auth.proxyJump) {
        clearTimeout(timer)
        reject(
          new Error(
            '该连接配置了 ProxyJump：Code Space 的文件树/搜索暂不支持经跳板机直连，请使用终端或 agent 工具操作远端文件'
          )
        )
        return
      }
      if (auth.password) {
        config.password = auth.password
      } else if (auth.privateKey) {
        config.privateKey = auth.privateKey
      } else {
        clearTimeout(timer)
        reject(
          new Error(
            '没有可用私钥，也没有配置密码：请在远程面板给该连接填私钥路径（或改用密码认证），再重开工作区'
          )
        )
        return
      }
      client.connect(config)
    })

    const sftp = await new Promise((resolve, reject) => {
      client.sftp((error, channel) => (error ? reject(error) : resolve(channel)))
    })
    return { client, sftp, meta, proxyJump: auth.proxyJump }
  })()

  pool.set(key, { promise })
  promise.catch(() => pool.delete(key))
  return promise
}

function expandLocal(path) {
  if (!path) return ''
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) return ljoin(homedir(), path.slice(2))
  return path
}

/** 从会话 cwd 认出远程工作区；不是远程就返回 null */
export async function remoteInfo(cwd) {
  if (typeof cwd !== 'string') return null
  const match = /^(.*remote-workspaces[\\/][^\\/]+)/i.exec(cwd.replace(/\\/g, '/'))
  if (!match) return null
  const mirrorRoot = match[1].replace(/\//g, process.platform === 'win32' ? '\\' : '/')
  const meta = await remoteMetaForCwd(cwd)
  if (!meta) return null
  const remoteRoot = expandRemote(meta.remotePath, meta.user)
  return {
    meta,
    mirrorRoot,
    remoteRoot,
    toRemote(localAbs) {
      const rel = localAbs.replace(/\\/g, '/').slice(mirrorRoot.replace(/\\/g, '/').length).replace(/^\/+/, '')
      return rel ? rpath.join(remoteRoot, rel) : remoteRoot
    },
    toLocal(remoteAbs) {
      const rel = rpath.relative(remoteRoot, remoteAbs)
      return rel ? ljoin(mirrorRoot, ...rel.split('/')) : mirrorRoot
    }
  }
}

/** 在远端执行一条命令（复用同一个 SSH 连接） */
export async function remoteExec(info, command, timeout = 20000) {
  const { client } = await connectSftp(info.meta)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('远端命令超时')), timeout)
    client.exec(command, (error, stream) => {
      if (error) {
        clearTimeout(timer)
        reject(error)
        return
      }
      let stdout = ''
      let stderr = ''
      stream.on('data', (chunk) => {
        stdout += chunk.toString('utf8')
      })
      stream.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8')
      })
      stream.on('close', (code) => {
        clearTimeout(timer)
        resolve({ code, stdout, stderr })
      })
    })
  })
}

function sftpCall(sftp, method, ...args) {
  return new Promise((resolve, reject) => {
    sftp[method](...args, (error, result) => (error ? reject(error) : resolve(result)))
  })
}

export async function listDir(info, localPath) {
  const { sftp } = await connectSftp(info.meta)
  const dir = info.toRemote(localPath || info.mirrorRoot)
  const entries = await sftpCall(sftp, 'readdir', dir)
  const list = entries.map((entry) => {
    const remotePath = rpath.join(dir, entry.filename)
    const isDir = (entry.attrs.mode & 0o040000) === 0o040000 || entry.longname?.startsWith('d')
    return {
      name: entry.filename,
      path: info.toLocal(remotePath),
      remotePath,
      dir: Boolean(isDir),
      size: entry.attrs.size || 0,
      mtimeMs: (entry.attrs.mtime || 0) * 1000
    }
  })
  list.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
  return { path: info.toLocal(dir), entries: list, remote: true }
}

export async function statPath(info, localPath) {
  const { sftp } = await connectSftp(info.meta)
  const remotePath = info.toRemote(localPath)
  const attrs = await sftpCall(sftp, 'stat', remotePath)
  return {
    path: info.toLocal(remotePath),
    dir: (attrs.mode & 0o040000) === 0o040000,
    size: attrs.size || 0,
    mtimeMs: (attrs.mtime || 0) * 1000,
    remote: true
  }
}

export async function readText(info, localPath) {
  const { sftp } = await connectSftp(info.meta)
  const remotePath = info.toRemote(localPath)
  const buffer = await sftpCall(sftp, 'readFile', remotePath)
  const truncated = buffer.length > READ_LIMIT
  const slice = truncated ? buffer.subarray(0, READ_LIMIT) : buffer
  const sample = slice.subarray(0, Math.min(slice.length, 8192))
  if (sample.includes(0)) {
    return { path: info.toLocal(remotePath), size: buffer.length, mtimeMs: 0, binary: true, text: '', truncated, remote: true }
  }
  let text = slice.toString('utf8')
  const bom = text.startsWith('\uFEFF')
  if (bom) text = text.slice(1)
  return {
    path: info.toLocal(remotePath),
    size: buffer.length,
    mtimeMs: 0,
    binary: false,
    truncated,
    bom,
    text,
    lines: text.length === 0 ? 0 : text.split('\n').length,
    eol: text.includes('\r\n') ? 'crlf' : 'lf',
    remote: true
  }
}

export async function writeText(info, localPath, text, options = {}) {
  const { sftp } = await connectSftp(info.meta)
  const remotePath = info.toRemote(localPath)
  const body = Buffer.from(options.bom ? `\uFEFF${text}` : text, 'utf8')
  const tmp = `${remotePath}.${Math.random().toString(36).slice(2, 8)}.tmp`
  try {
    await sftpCall(sftp, 'writeFile', tmp, body)
    try {
      await sftpCall(sftp, 'rename', tmp, remotePath)
    } catch {
      // 有些 SFTP 服务端不允许 rename 覆盖已存在文件：退化成直接写
      await sftpCall(sftp, 'writeFile', remotePath, body)
      await sftpCall(sftp, 'unlink', tmp).catch(() => {})
    }
  } catch (error) {
    throw Object.assign(new Error(`远端写入失败：${error.message}`), { code: 'remote' })
  }
  return { path: info.toLocal(remotePath), size: body.length, mtimeMs: Date.now(), remote: true }
}

/**
 * 快速打开用的远端索引。
 *
 * SFTP 每个 readdir 大约 100ms，串行爬目录会非常慢，所以：
 *   - 并发 6 个 readdir
 *   - 浅层优先（BFS），深度上限 8
 *   - 命中上限立刻返回
 * 客户端还有 5 分钟缓存，第二次打开很快。
 */

/** 文件名搜索：在服务器上跑 find（比 SFTP 逐目录 readdir 快得多，也不会因深度上限漏掉文件） */
export async function searchFiles(info, options = {}) {
  const needle = typeof options.query === 'string' ? options.query.trim() : ''
  const limit = Math.min(Math.max(Number(options.limit) || SEARCH_LIMIT, 1), 20000)
  const prune = []
  for (const dir of ['.git', 'node_modules', 'dist', 'build', 'out', 'target', '.venv', 'venv', '__pycache__', '.cache', '.next', '.nuxt', '.turbo']) {
    prune.push('-name', shellQuote(dir), '-o')
  }
  // 去掉最后一个 -o
  if (prune.length > 0) prune.pop()
  const findExpr = prune.length > 0
    ? `\\( ${prune.join(' ')} \\) -prune -o -type f -print`
    : '-type f -print'
  const grep = needle ? ` | grep -iF -e ${shellQuote(needle)}` : ''
  const command = `cd ${shellQuote(info.remoteRoot)} && find . ${findExpr} 2>/dev/null${grep} | head -n ${limit}`
  let result
  try {
    result = await remoteExec(info, command, 45000)
  } catch (error) {
    return searchFilesSftp(info, options)
  }
  const files = []
  for (const raw of String(result.stdout || '').split(/\r?\n/)) {
    let rel = raw.trim()
    if (!rel || rel === '.') continue
    if (rel.startsWith('./')) rel = rel.slice(2)
    if (!needle || rel.toLowerCase().includes(needle.toLowerCase())) {
      files.push({ path: info.toLocal(info.toRemote(rel)), rel, name: rel.split('/').pop() || rel })
    }
    if (files.length >= limit) break
  }
  if (files.length === 0 && needle && result.code !== 0) {
    // 远端没有 find/grep 或命令失败：退回 SFTP 遍历
    return searchFilesSftp(info, options)
  }
  return { files, truncated: files.length >= limit, root: info.mirrorRoot, remote: true }
}

async function searchFilesSftp(info, options = {}) {
  const { sftp } = await connectSftp(info.meta)
  const needle = typeof options.query === 'string' ? options.query.trim().toLowerCase() : ''
  const limit = Math.min(Math.max(Number(options.limit) || SEARCH_LIMIT, 1), 20000)
  const files = []
  const queue = [{ dir: info.remoteRoot, depth: 0 }]
  let active = 0

  await new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }

    const pump = () => {
      if (settled) return
      if (files.length >= limit) return finish()
      while (active < 6 && queue.length > 0) {
        const current = queue.shift()
        active += 1
        void sftpCall(sftp, 'readdir', current.dir)
          .then((entries) => {
            for (const entry of entries) {
              if (files.length >= limit) break
              const remotePath = rpath.join(current.dir, entry.filename)
              const isDir = (entry.attrs.mode & 0o040000) === 0o040000 || entry.longname?.startsWith('d')
              if (isDir) {
                if (SKIP_DIRS.has(entry.filename) || entry.filename.startsWith('.git')) continue
                if (current.depth + 1 > SEARCH_DEPTH) continue
                queue.push({ dir: remotePath, depth: current.depth + 1 })
                continue
              }
              const rel = rpath.relative(info.remoteRoot, remotePath)
              if (needle && !rel.toLowerCase().includes(needle)) continue
              files.push({ path: info.toLocal(remotePath), rel, name: entry.filename })
            }
          })
          .catch(() => undefined)
          .finally(() => {
            active -= 1
            if (files.length >= limit) finish()
            else if (active === 0 && queue.length === 0) finish()
            else pump()
          })
      }
      if (active === 0 && queue.length === 0) finish()
    }

    pump()
  })

  return { files, truncated: files.length >= limit, root: info.mirrorRoot, remote: true }
}

/** 插件停用/DSH 退出时关掉所有远端连接 */

/** 远端内容搜索：在服务器上用 grep 跑，结果路径映射回本地镜像（供 Monaco 打开） */
export async function searchContent(info, options = {}) {
  const query = typeof options.query === 'string' ? options.query.trim() : ''
  if (!query) throw Object.assign(new Error('请输入要搜索的内容'), { code: 'bad-argument' })
  if (query.length > 200) throw Object.assign(new Error('搜索内容太长'), { code: 'bad-argument' })
  if (options.regex === true) {
    try {
      new RegExp(query)
    } catch {
      throw Object.assign(new Error('正则表达式不合法'), { code: 'bad-argument' })
    }
  }
  const started = Date.now()
  const splitList = (raw) =>
    String(raw || '')
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
  const include = splitList(options.include)
  const exclude = splitList(options.exclude)
  const flags = ['-rnIE', '--binary-files=without-match']
  if (options.caseSensitive !== true) flags.push('-i')
  if (options.wholeWord === true) flags.push('-w')
  if (options.regex !== true) flags.push('-F')
  // 常见重目录直接跳过（避免 node_modules 把结果挤掉）
  for (const dir of ['.git', 'node_modules', 'dist', 'build', 'out', '.venv', '__pycache__', '.next', 'target', '.cache']) {
    flags.push(`--exclude-dir=${shellQuote(dir)}`)
  }
  for (const pattern of include) flags.push(`--include=${shellQuote(pattern)}`)
  for (const pattern of exclude) flags.push(`--exclude=${shellQuote(pattern)}`)
  const limit = 800
  const command =
    `cd ${shellQuote(info.remoteRoot)} && ` +
    `grep ${flags.join(' ')} -e ${shellQuote(query)} . 2>/dev/null | head -n ${limit}`
  const result = await remoteExec(info, command, 45000)
  const matches = []
  for (const raw of result.stdout.split(/\r?\n/)) {
    if (!raw) continue
    const first = raw.indexOf(':')
    if (first < 0) continue
    const second = raw.indexOf(':', first + 1)
    if (second < 0) continue
    let rel = raw.slice(0, first)
    if (rel.startsWith('./')) rel = rel.slice(2)
    const line = Number(raw.slice(first + 1, second)) || 0
    const text = raw.slice(second + 1)
    if (!rel || !line) continue
    const local = info.toLocal(rpath.join(info.remoteRoot, rel))
    matches.push({ path: local, rel, line, text: text.length > 400 ? text.slice(0, 400) + '…' : text })
  }
  return {
    engine: 'remote',
    root: info.mirrorRoot,
    remote: true,
    truncated: matches.length >= limit,
    elapsedMs: Date.now() - started,
    matches
  }
}

function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'"
}

export async function closeRemoteConnections() {
  const entries = [...pool.values()]
  pool.clear()
  for (const entry of entries) {
    try {
      const { client } = await entry.promise
      client.end()
    } catch {
      /* 连接可能已经断了 */
    }
  }
}
