/**
 * Git 只读集成（宿主半边）。
 *
 * 只做三件事：仓库检测 / 工作区状态 / 取 HEAD 版本内容（给 diff 用）。
 * 一律用 `execFile('git', [...])`，不经 shell，参数固定，路径先做仓库内校验。
 */

import { execFile } from 'node:child_process'
import { readdir, stat, unlink } from 'node:fs/promises'
import { promisify } from 'node:util'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

const run = promisify(execFile)

const GIT_TIMEOUT = 20000
const MAX_BUFFER = 16 * 1024 * 1024

async function git(cwd, args) {
  try {
    const { stdout } = await run('git', args, {
      cwd,
      timeout: GIT_TIMEOUT,
      maxBuffer: MAX_BUFFER,
      windowsHide: true
    })
    return stdout
  } catch (error) {
    const message = (error && (error.stderr || error.message)) || 'git 执行失败'
    throw Object.assign(new Error(String(message).trim().split('\n')[0]), { code: 'git' })
  }
}

/** 当前目录所属仓库的根；不是仓库返回 null */
export async function repoRoot(cwd) {
  try {
    const out = await git(cwd, ['rev-parse', '--show-toplevel'])
    const root = out.trim()
    return root || null
  } catch {
    return null
  }
}

function assertInside(root, target) {
  const abs = resolve(target)
  const rel = relative(root, abs)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw Object.assign(new Error('path is outside the repository'), { code: 'outside' })
  }
  return rel.split(sep).join('/')
}

function parsePorcelain(out) {
  const parts = out.split('\0')
  const items = []
  for (let i = 0; i < parts.length; i += 1) {
    const entry = parts[i]
    if (!entry || entry.length < 4) continue
    const indexStatus = entry[0]
    const worktreeStatus = entry[1]
    const filePath = entry.slice(3)
    let from
    if (indexStatus === 'R' || indexStatus === 'C') {
      from = parts[i + 1]
      i += 1
    }
    const staged = indexStatus !== ' ' && indexStatus !== '?'
    const code =
      indexStatus === '?' && worktreeStatus === '?'
        ? 'U'
        : indexStatus !== ' '
          ? indexStatus
          : worktreeStatus
    items.push({ path: filePath, from, code, staged, index: indexStatus, worktree: worktreeStatus })
  }
  return items
}

export async function status(cwd) {
  const root = await repoRoot(cwd)
  if (!root) throw Object.assign(new Error('当前工作区不是 Git 仓库'), { code: 'no-repo' })

  let branch = 'HEAD'
  try {
    branch = (await git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim() || 'HEAD'
  } catch {
    /* 空仓库没有 HEAD，保持默认 */
  }

  let ahead = 0
  let behind = 0
  try {
    const counts = (await git(root, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'])).trim()
    const [left, right] = counts.split(/\s+/).map(Number)
    behind = Number.isFinite(left) ? left : 0
    ahead = Number.isFinite(right) ? right : 0
  } catch {
    /* 没有上游分支时不显示 ahead/behind */
  }

  const raw = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])
  const changes = parsePorcelain(raw)
    .map((item) => ({
      ...item,
      absPath: resolve(root, ...item.path.split('/'))
    }))
    .slice(0, 2000)

  return { root, branch, ahead, behind, changes }
}

export async function log(cwd, limit = 20) {
  const root = await repoRoot(cwd)
  if (!root) throw Object.assign(new Error('当前工作区不是 Git 仓库'), { code: 'no-repo' })
  const count = Math.min(Math.max(Number(limit) || 20, 1), 100)
  const out = await git(root, ['log', `-n${count}`, '--pretty=format:%h%x1f%an%x1f%ar%x1f%s%x1e'])
  const commits = out
    .split('\x1e')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [hash, author, when, subject] = chunk.split('\x1f')
      return { hash, author, when, subject }
    })
  return { root, commits }
}

/**
 * 取某个文件在 HEAD 里的内容（给 diff 的左侧）。
 * 未跟踪/新增文件没有 HEAD 版本 → 返回空字符串。
 */
export async function headContent(cwd, target) {
  const root = await repoRoot(cwd)
  if (!root) throw Object.assign(new Error('当前工作区不是 Git 仓库'), { code: 'no-repo' })
  const rel = assertInside(root, target)
  try {
    return { root, rel, text: await git(root, ['show', `HEAD:${rel}`]), exists: true }
  } catch {
    return { root, rel, text: '', exists: false }
  }
}

/* ─────────────────────────── 写操作 ─────────────────────────── */

async function requireRepo(cwd) {
  const root = await repoRoot(cwd)
  if (!root) throw Object.assign(new Error('当前工作区不是 Git 仓库'), { code: 'no-repo' })
  return root
}

function toRelPaths(root, paths) {
  if (!Array.isArray(paths) || paths.length === 0) return []
  return paths
    .filter((item) => typeof item === 'string' && item)
    .map((item) => assertInside(root, item))
    .slice(0, 500)
}

/**
 * 在给定目录下（深度 ≤ maxDepth）查找 Git 仓库目录，返回相对 root 的路径数组。
 * '' 表示 root 本身是仓库。
 */
export async function findRepos(root, maxDepth = 3) {
  const skip = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'logs', 'data', 'node', 'python', 'venv', '.venv'])
  const results = []
  const queue = [{ dir: root, depth: 0 }]
  while (queue.length > 0 && results.length < 30) {
    const { dir, depth } = queue.shift()
    let isRepo = false
    try {
      const info = await stat(join(dir, '.git'))
      isRepo = Boolean(info)
    } catch {
      isRepo = false
    }
    if (isRepo) results.push(relative(root, dir).split(sep).join('/'))
    if (depth >= maxDepth) continue
    let entries = []
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (skip.has(entry.name)) continue
      if (entry.name.startsWith('.') && entry.name !== '.github') continue
      queue.push({ dir: join(dir, entry.name), depth: depth + 1 })
    }
  }
  return results
}

/** git add <paths> */
export async function stage(cwd, paths) {
  const root = await requireRepo(cwd)
  const rels = toRelPaths(root, paths)
  if (rels.length === 0) return { staged: 0 }
  await git(root, ['add', '--', ...rels])
  return { staged: rels.length }
}

/** 取消暂存：优先 git restore --staged（Git ≥ 2.23），退回 git reset HEAD */
export async function unstage(cwd, paths) {
  const root = await requireRepo(cwd)
  const rels = toRelPaths(root, paths)
  if (rels.length === 0) return { unstaged: 0 }
  try {
    await git(root, ['restore', '--staged', '--', ...rels])
  } catch {
    await git(root, ['reset', 'HEAD', '--', ...rels])
  }
  return { unstaged: rels.length }
}

/** 暂存全部（含未跟踪） */
export async function stageAll(cwd) {
  const root = await requireRepo(cwd)
  await git(root, ['add', '-A'])
  return { ok: true }
}

/** 取消全部暂存 */
export async function unstageAll(cwd) {
  const root = await requireRepo(cwd)
  try {
    await git(root, ['restore', '--staged', '.'])
  } catch {
    await git(root, ['reset', 'HEAD', '.'])
  }
  return { ok: true }
}

/**
 * 放弃更改：
 *   - 已跟踪文件 → git checkout -- <path>（还原到 HEAD/暂存区版本）
 *   - 未跟踪文件 → 直接删除（VS Code 的 Discard 行为，但这里要显式传 untracked 列表）
 */
export async function discard(cwd, paths = [], untracked = []) {
  const root = await requireRepo(cwd)
  const tracked = toRelPaths(root, paths)
  if (tracked.length > 0) await git(root, ['checkout', '--', ...tracked])

  let removed = 0
  for (const item of Array.isArray(untracked) ? untracked.slice(0, 500) : []) {
    if (typeof item !== 'string' || !item) continue
    const abs = join(root, item)
    try {
      assertInside(root, abs)
      await unlink(abs)
      removed += 1
    } catch {
      /* 文件已不存在或是目录：跳过 */
    }
  }
  return { restored: tracked.length, removed }
}

/** 提交（只带 -m，不会弹编辑器） */
export async function commit(cwd, message) {
  const root = await requireRepo(cwd)
  const text = typeof message === 'string' ? message.trim() : ''
  if (!text) throw Object.assign(new Error('提交信息不能为空'), { code: 'bad-argument' })
  if (text.length > 5000) throw Object.assign(new Error('提交信息过长'), { code: 'bad-argument' })
  const output = await git(root, ['commit', '-m', text])
  const firstLine = output.trim().split('\n')[0] || '已提交'
  return { output: firstLine }
}

/**
 * 推送当前分支。
 * 没有上游分支时自动「发布分支」（git push -u origin <branch>），
 * 和 VS Code 的 Publish Branch 行为一致 —— 新仓库第一次推送不需要先去终端敲命令。
 */
export async function push(cwd) {
  const root = await requireRepo(cwd)

  const branch = (await git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
  if (!branch || branch === 'HEAD') {
    throw Object.assign(new Error('当前处于游离 HEAD，无法推送；先切到一个分支'), { code: 'git' })
  }

  try {
    const output = await git(root, ['push'])
    return { output: output.trim().split('\n').slice(-1)[0] || '已推送' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const noUpstream = /no configured push destination|no upstream branch|has no upstream|set-upstream/i.test(message)
    if (!noUpstream) throw error

    // 没有上游：尝试把当前分支发布到 origin
    try {
      const output = await git(root, ['push', '-u', 'origin', branch])
      return { output: output.trim().split('\n').slice(-1)[0] || `已发布分支 ${branch}` }
    } catch (retryError) {
      const retryMessage = retryError instanceof Error ? retryError.message : String(retryError)
      if (/no such remote|does not appear to be a git repository|origin/i.test(retryMessage)) {
        throw Object.assign(new Error('这个仓库还没有配置远端（origin），先执行：git remote add origin <仓库地址>'), {
          code: 'git'
        })
      }
      throw Object.assign(new Error(`推送失败：${retryMessage}`), { code: 'git' })
    }
  }
}

