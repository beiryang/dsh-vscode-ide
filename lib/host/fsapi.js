/**
 * 工作区文件访问（宿主半边）。
 *
 * 安全模型（发布版必须守住）：
 *   1. 根目录只来自「当前会话的 cwd」（ctx.sessions.get(sessionId).header.cwd），
 *      不接受客户端传进来的任意根路径；
 *   2. 所有路径先做 realpath，再判断是否落在根目录之下（防 symlink 逃逸）；
 *   3. 读写一律 UTF-8，读超 2 MiB 返回 truncated 且禁止保存。
 *
 * 工作区外的只读访问留到后续版本，用显式「打开文件」动作 + 用户确认来做，
 * 不在这里开一个任意路径读取的口子。
 */

import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, basename } from 'node:path'
import { realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

export const READ_LIMIT = 2 * 1024 * 1024
const BOM = '\uFEFF'

function lower(p) {
  return process.platform === 'win32' ? p.toLowerCase() : p
}

/** 当前会话的工作目录；拿不到返回 null（客户端会提示"先打开一个会话"） */
export function workspaceCwd(ctx, sessionId) {
  try {
    const sessions = ctx && typeof ctx.get === 'function' ? ctx.get('sessions') : undefined
    const session = sessionId && sessions && typeof sessions.get === 'function' ? sessions.get(sessionId) : undefined
    const cwd = session && session.header && session.header.cwd
    if (typeof cwd === 'string' && cwd) return resolve(cwd)
  } catch {
    /* 会话服务不可用时按"没有工作区"处理 */
  }
  return null
}

/** 把客户端给的路径解析成工作区内的绝对路径；越界抛 code=outside */
async function resolveInside(root, target) {
  const rootReal = await realpath(root)
  const abs = !target || target === '.' ? rootReal : isAbsolute(target) ? resolve(target) : resolve(rootReal, target)

  let real
  try {
    real = await realpath(abs)
  } catch {
    real = abs // 目标还不存在（保存新文件）时按字面路径判断
  }

  const rn = lower(real)
  const rootn = lower(rootReal)
  if (rn !== rootn && !rn.startsWith(rootn + sep)) {
    throw Object.assign(new Error('path is outside the session workspace'), { code: 'outside' })
  }
  return { path: real, root: rootReal }
}

export async function listDir(root, target) {
  const { path: abs } = await resolveInside(root, target)
  const st = await stat(abs)
  if (!st.isDirectory()) throw Object.assign(new Error('not a directory'), { code: 'not-dir' })

  const dirents = await readdir(abs, { withFileTypes: true })
  const entries = []
  for (const dirent of dirents) {
    const child = join(abs, dirent.name)
    let size = 0
    let mtimeMs = 0
    try {
      const s = await stat(child)
      size = s.size
      mtimeMs = s.mtimeMs
    } catch {
      /* 权限不足的条目仍然列出来，只是没有大小 */
    }
    entries.push({
      name: dirent.name,
      path: child,
      dir: dirent.isDirectory(),
      link: dirent.isSymbolicLink(),
      size,
      mtimeMs
    })
  }
  entries.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
  return { path: abs, entries }
}

export async function statPath(root, target) {
  const { path: abs } = await resolveInside(root, target)
  const st = await stat(abs)
  return { path: abs, dir: st.isDirectory(), size: st.size, mtimeMs: st.mtimeMs }
}

export async function readText(root, target) {
  const { path: abs } = await resolveInside(root, target)
  const st = await stat(abs)
  if (st.isDirectory()) throw Object.assign(new Error('is a directory'), { code: 'is-dir' })

  const buffer = await readFile(abs)
  const truncated = buffer.length > READ_LIMIT
  const slice = truncated ? buffer.subarray(0, READ_LIMIT) : buffer
  const sample = slice.subarray(0, Math.min(slice.length, 8192))
  const binary = sample.includes(0)

  if (binary) {
    return { path: abs, size: buffer.length, binary: true, text: '', truncated }
  }

  let text = slice.toString('utf8')
  const bom = text.startsWith(BOM)
  if (bom) text = text.slice(BOM.length)

  return {
    path: abs,
    size: buffer.length,
    mtimeMs: st.mtimeMs,
    binary: false,
    truncated,
    bom,
    text,
    lines: text.length === 0 ? 0 : text.split('\n').length,
    eol: text.includes('\r\n') ? 'crlf' : 'lf'
  }
}

/**
 * 保存。先写同目录临时文件再 rename，避免写到一半断电/崩溃把原文件截断。
 */
export async function writeText(root, target, text, options = {}) {
  const { path: abs } = await resolveInside(root, target)
  const st = await stat(abs).catch(() => undefined)
  if (st && st.isDirectory()) throw Object.assign(new Error('is a directory'), { code: 'is-dir' })
  if (st && st.size > READ_LIMIT) {
    throw Object.assign(new Error('file too large to save'), { code: 'too-large' })
  }

  const body = options.bom ? BOM + text : text
  const tmp = `${abs}.${randomBytes(4).toString('hex')}.tmp`
  try {
    await mkdir(dirnameOf(abs), { recursive: true })
    await writeFile(tmp, body, 'utf8')
    await rename(tmp, abs)
  } catch (error) {
    await rm(tmp, { force: true }).catch(() => {})
    throw error
  }
  const after = await stat(abs)
  return { path: abs, size: after.size, mtimeMs: after.mtimeMs }
}

function dirnameOf(file) {
  const at = Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\'))
  return at === -1 ? '.' : file.slice(0, at)
}

/** 快速打开用的目录索引：BFS 浅层优先，跳过重型目录，有硬上限 */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', '.idea', '.vscode',
  'dist', 'build', 'out', 'target', 'vendor', 'coverage', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', '.cache', '.turbo', 'tmp', 'temp'
])

export async function searchFiles(root, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 4000, 1), 20000)
  const maxDepth = Math.min(Math.max(Number(options.maxDepth) || 14, 1), 40)
  const needle = typeof options.query === 'string' ? options.query.trim().toLowerCase() : ''

  const { path: base } = await resolveInside(root, '.')
  const files = []
  const queue = [{ dir: base, depth: 0 }]

  while (queue.length > 0) {
    const current = queue.shift()
    let entries
    try {
      entries = await readdir(current.dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(current.dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.git')) continue
        if (current.depth + 1 > maxDepth) continue
        queue.push({ dir: full, depth: current.depth + 1 })
        continue
      }
      if (!entry.isFile()) continue
      const rel = relative(base, full).replace(/\\/g, '/')
      if (needle && !rel.toLowerCase().includes(needle)) continue
      files.push({ path: full, rel, name: entry.name })
      if (files.length >= limit) return { files, truncated: true, root: base }
    }
  }
  return { files, truncated: false, root: base }
}


/** 新建空文件或目录（不覆盖已存在的同名项） */
export async function createEntry(root, target, dir) {
  const { path: abs } = await resolveInside(root, target)
  if (dir) {
    await mkdir(abs)
  } else {
    await writeFile(abs, '', { flag: 'wx' })
  }
  return { path: abs, dir: Boolean(dir) }
}

/** 删除文件或目录（目录递归删除） */
export async function removeEntry(root, target) {
  const { path: abs } = await resolveInside(root, target)
  if (abs === (await realpath(root))) {
    throw Object.assign(new Error('不能删除工作区根目录'), { code: 'bad-argument' })
  }
  await rm(abs, { recursive: true, force: false })
  return { path: abs }
}

/** 重命名（只改名字，不移动目录）；返回新的绝对路径 */
export async function renameEntry(root, target, nextName) {
  const { path: abs } = await resolveInside(root, target)
  const name = String(nextName ?? '').trim()
  if (!name || name === '.' || name === '..' || /[\\/:*?"<>|]/.test(name)) {
    throw Object.assign(new Error('文件名不合法'), { code: 'bad-argument' })
  }
  const to = join(dirname(abs), name)
  await resolveInside(root, to)
  await rename(abs, to)
  return { path: to, name: basename(to) }
}

/** 在系统资源管理器里定位该文件 */
export async function revealEntry(root, target) {
  const { path: abs } = await resolveInside(root, target)
  if (process.platform !== 'win32') {
    throw Object.assign(new Error('仅 Windows 支持在资源管理器中定位'), { code: 'bad-argument' })
  }
  spawn('explorer.exe', ['/select,', abs], { detached: true, stdio: 'ignore' }).unref()
  return { path: abs }
}


/** 移动文件/目录到目标目录（保持原名） */
export async function moveEntry(root, from, toDir) {
  const src = await resolveInside(root, from)
  const destDir = await resolveInside(root, toDir)
  const name = basename(src.path)
  const to = join(destDir.path, name)
  if (lower(to) === lower(src.path)) return { path: src.path, moved: false }
  const srcn = lower(src.path)
  const ton = lower(to)
  if (ton === srcn || ton.startsWith(srcn + sep)) {
    throw Object.assign(new Error('不能把目录移动到它自己里面'), { code: 'bad-argument' })
  }
  await resolveInside(root, to)
  try {
    await stat(to)
    throw Object.assign(new Error('目标位置已存在同名文件或目录'), { code: 'exists' })
  } catch (error) {
    if (error && error.code !== 'ENOENT') throw error
  }
  await rename(src.path, to)
  return { path: to, moved: true }
}
