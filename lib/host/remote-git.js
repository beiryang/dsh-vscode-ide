/**
 * 远程工作区的 Git 支持：在服务器上跑 git，结果映射回本地镜像路径。
 *
 * 为什么不下载仓库在本地跑：镜像目录可能很大、也可能不是完整仓库；
 * 直接在远端执行 `git -C <remoteRoot> ...` 最省事，且和用户的服务器状态一致。
 *
 * 路径约定：
 *   - status 用 `--relative`，输出相对 remoteRoot 的路径，正好对应本地 mirrorRoot
 *   - diff 用 `HEAD:./<rel>`（相对当前目录）拿 HEAD 内容
 */

import { relative as rpathRelative } from 'node:path/posix'
import { join as ljoin } from 'node:path'

import { remoteExec } from './remote-fs.js'

const GIT_TIMEOUT = 25000

/** 把 info 的「工作目录」下移 gitDir 层，其余映射逻辑保持不变 */
export function withGitDir(info, gitDir) {
  const rel = typeof gitDir === 'string' ? gitDir.trim().replace(/^[/\\]+/, '') : ''
  if (!rel) return info
  return {
    ...info,
    remoteRoot: `${info.remoteRoot.replace(/\/+$/, '')}/${rel}`,
    mirrorRoot: ljoin(info.mirrorRoot, ...rel.split('/'))
  }
}

/** 在远程工作区里找仓库目录（相对 remoteRoot） */
export async function remoteFindRepos(info, maxDepth = 3) {
  const result = await remoteExec(
    info,
    `find ${q(info.remoteRoot)} -maxdepth ${maxDepth} -name .git -prune -print 2>/dev/null | head -30`,
    25000
  )
  const base = info.remoteRoot.replace(/\/+$/, '')
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((gitPath) => {
      const dir = gitPath.replace(/\/\.git$/, '')
      if (dir === base) return ''
      return dir.startsWith(`${base}/`) ? dir.slice(base.length + 1) : null
    })
    .filter((item) => item !== null)
}


function q(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`
}

async function runRaw(info, args, timeout = GIT_TIMEOUT) {
  const command = ['git', '-C', q(info.remoteRoot), ...args.map(q)].join(' ')
  return remoteExec(info, command, timeout)
}

async function gitOrThrow(info, args) {
  const result = await runRaw(info, args)
  if (result.code !== 0) {
    const message = (result.stderr || result.stdout || '').trim().split('\n')[0] || 'git 执行失败'
    throw Object.assign(new Error(message), { code: 'git' })
  }
  return result.stdout
}

/** 仓库根（远端绝对路径）；不在仓库里返回 null */
async function repoRootRemote(info) {
  const result = await runRaw(info, ['rev-parse', '--show-toplevel'])
  if (result.code !== 0) return null
  const root = result.stdout.trim()
  return root || null
}

async function requireRepo(info) {
  const root = await repoRootRemote(info)
  if (!root) throw Object.assign(new Error('当前远程工作区不是 Git 仓库'), { code: 'no-repo' })
  return root
}

function parsePorcelain(out) {
  const parts = out.split('\0')
  const items = []
  for (let index = 0; index < parts.length; index += 1) {
    const entry = parts[index]
    if (!entry || entry.length < 4) continue
    const indexStatus = entry[0]
    const worktreeStatus = entry[1]
    const filePath = entry.slice(3)
    let from
    if (indexStatus === 'R' || indexStatus === 'C') {
      from = parts[index + 1]
      index += 1
    }
    const staged = indexStatus !== ' ' && indexStatus !== '?'
    const code =
      indexStatus === '?' && worktreeStatus === '?'
        ? 'U'
        : indexStatus !== ' '
          ? indexStatus
          : worktreeStatus
    items.push({ path: filePath, from, code, staged })
  }
  return items
}

function toLocalPath(info, relPath) {
  return relPath ? ljoin(info.mirrorRoot, ...relPath.split('/')) : info.mirrorRoot
}

export async function remoteStatus(info) {
  const root = await requireRepo(info)
  const branch = (await gitOrThrow(info, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
  // porcelain 里的路径相对仓库根；remoteRoot 可能只是仓库里的一个子目录
  const prefix = (await gitOrThrow(info, ['rev-parse', '--show-prefix'])).trim()
  let ahead = 0
  let behind = 0
  try {
    const counts = (await gitOrThrow(info, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'])).trim()
    const [left, right] = counts.split(/\s+/).map((value) => Number(value) || 0)
    ahead = left
    behind = right
  } catch {
    /* 没有上游分支：保持 0/0 */
  }
  const out = await gitOrThrow(info, ['status', '--porcelain', '-z'])
  const changes = []
  for (const item of parsePorcelain(out)) {
    const rel = prefix ? (item.path.startsWith(prefix) ? item.path.slice(prefix.length) : null) : item.path
    if (rel === null) continue
    changes.push({
      path: rel,
      absPath: toLocalPath(info, rel),
      code: item.code,
      staged: item.staged,
      from: item.from
    })
  }
  return { root: info.mirrorRoot, repoRoot: root, branch, ahead, behind, changes: changes.slice(0, 2000) }
}

export async function remoteLog(info, limit = 20) {
  const count = Math.min(Math.max(Number(limit) || 20, 1), 100)
  const out = await gitOrThrow(info, ['log', `-${count}`, '--topo-order', '--pretty=format:%H%x09%h%x09%an%x09%ar%x09%s%x09%P%x09%D'])
  const commits = out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [full, hash, author, when, subject, parents, refs] = line.split('\t')
      return { hash, author, when, subject, refs: refs ?? '', full, parents: (parents ?? '').split(' ').filter(Boolean) }
    })
  return { root: info.mirrorRoot, commits }
}

/** HEAD 里的文件内容（相对当前目录，`HEAD:./path`） */
export async function remoteHeadContent(info, localPath) {
  const remotePath = info.toRemote(localPath)
  const rel = rpathRelative(info.remoteRoot, remotePath)
  if (!rel || rel.startsWith('..')) {
    return { root: info.mirrorRoot, rel: '', text: '', exists: false }
  }
  try {
    const text = await gitOrThrow(info, ['show', `HEAD:./${rel}`])
    return { root: info.mirrorRoot, rel, text, exists: true }
  } catch {
    return { root: info.mirrorRoot, rel, text: '', exists: false }
  }
}

function rels(info, paths) {
  return (Array.isArray(paths) ? paths : [])
    .filter((item) => typeof item === 'string' && item)
    .map((item) => {
      const remotePath = info.toRemote(item)
      return rpathRelative(info.remoteRoot, remotePath)
    })
    .filter((rel) => rel && !rel.startsWith('..'))
    .slice(0, 500)
}

export async function remoteStage(info, paths) {
  const list = rels(info, paths)
  if (list.length === 0) return { staged: 0 }
  await gitOrThrow(info, ['add', '--', ...list])
  return { staged: list.length }
}

export async function remoteUnstage(info, paths) {
  const list = rels(info, paths)
  if (list.length === 0) return { unstaged: 0 }
  try {
    await gitOrThrow(info, ['restore', '--staged', '--', ...list])
  } catch {
    await gitOrThrow(info, ['reset', 'HEAD', '--', ...list])
  }
  return { unstaged: list.length }
}

export async function remoteStageAll(info) {
  await requireRepo(info)
  await gitOrThrow(info, ['add', '-A'])
  return { ok: true }
}

export async function remoteUnstageAll(info) {
  await requireRepo(info)
  try {
    await gitOrThrow(info, ['restore', '--staged', '.'])
  } catch {
    await gitOrThrow(info, ['reset', 'HEAD', '.'])
  }
  return { ok: true }
}

export async function remoteCommit(info, message) {
  const text = typeof message === 'string' ? message.trim() : ''
  if (!text) throw Object.assign(new Error('提交信息不能为空'), { code: 'bad-argument' })
  if (text.length > 5000) throw Object.assign(new Error('提交信息过长'), { code: 'bad-argument' })
  const out = await gitOrThrow(info, ['commit', '-m', text])
  return { output: out.trim().split('\n')[0] || '已提交' }
}

export async function remoteCommitInfo(info, hash) {
  const safeHash = typeof hash === 'string' ? hash.trim() : ''
  if (!/^[0-9a-f]{4,64}$/i.test(safeHash)) {
    throw Object.assign(new Error('提交号不合法'), { code: 'bad-argument' })
  }
  const out = await gitOrThrow(info, [
    'show',
    '--name-status',
    '--no-renames',
    '--pretty=format:%h%x1f%an%x1f%ar%x1f%s%x1f%D',
    safeHash
  ])
  const lines = out.split('\n')
  const [shortHash, author, when, subject, refs] = (lines[0] ?? '').split('\x1f')
  const files = lines
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, path] = line.split('\t')
      return status && path ? { status: status[0], path } : null
    })
    .filter(Boolean)
  return { hash: shortHash ?? safeHash, author, when, subject, refs: refs ?? '', files }
}

export async function remoteCommitFile(info, hash, filePath) {
  const safeHash = typeof hash === 'string' ? hash.trim() : ''
  if (!/^[0-9a-f]{4,64}$/i.test(safeHash)) {
    throw Object.assign(new Error('提交号不合法'), { code: 'bad-argument' })
  }
  const rel = String(filePath ?? '').replace(/\\/g, '/').replace(/^\/+/, '')
  if (!rel || rel.split('/').includes('..')) throw Object.assign(new Error('路径不合法'), { code: 'bad-argument' })
  const read = async (rev) => {
    try {
      return await gitOrThrow(info, ['show', `${rev}:${rel}`])
    } catch {
      return ''
    }
  }
  return { left: await read(`${safeHash}^`), right: await read(safeHash), rel }
}

export async function remotePull(info) {
  const out = await gitOrThrow(info, ['pull', '--ff-only'])
  return { output: out.trim().split('\n').slice(-1)[0] || '已拉取' }
}

export async function remoteFetch(info) {
  const out = await gitOrThrow(info, ['fetch', '--all', '--prune'])
  return { output: out.trim().split('\n').slice(-1)[0] || '已获取远端' }
}

export async function remotePush(info) {
  const branch = (await gitOrThrow(info, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
  if (!branch || branch === 'HEAD') {
    throw Object.assign(new Error('当前处于游离 HEAD，无法推送；先切到一个分支'), { code: 'git' })
  }
  const first = await runRaw(info, ['push'])
  if (first.code === 0) return { output: first.stdout.trim().split('\n').slice(-1)[0] || '已推送' }
  const message = (first.stderr || first.stdout || '').trim()
  if (!/no configured push destination|no upstream branch|has no upstream|set-upstream/i.test(message)) {
    throw Object.assign(new Error(message.split('\n')[0] || '推送失败'), { code: 'git' })
  }
  try {
    const published = await gitOrThrow(info, ['push', '-u', 'origin', branch])
    return { output: published.trim().split('\n').slice(-1)[0] || `已发布分支 ${branch}` }
  } catch (error) {
    throw Object.assign(new Error(`推送失败：${error.message}`), { code: 'git' })
  }
}

export async function remoteDiscard(info, paths = [], untracked = []) {
  const list = rels(info, paths)
  if (list.length > 0) await gitOrThrow(info, ['checkout', '--', ...list])
  let removed = 0
  for (const rel of Array.isArray(untracked) ? untracked.slice(0, 500) : []) {
    if (typeof rel !== 'string' || !rel || rel.startsWith('..')) continue
    // 远端路径必须用 / 拼接（Windows 的 ljoin 会给出反斜杠，rm 找不到文件）
    const remotePath = `${info.remoteRoot.replace(/\/+$/, '')}/${rel.replace(/^\/+/, '')}`
    const result = await remoteExec(info, `rm -f -- ${q(remotePath)}`)
    if (result.code === 0) removed += 1
  }
  return { restored: list.length, removed }
}


function assertRemoteRef(value) {
  const ref = String(value ?? '').trim()
  if (!/^[0-9a-f]{4,64}$/i.test(ref)) {
    throw Object.assign(new Error('提交号不合法'), { code: 'bad-argument' })
  }
  return ref
}

function assertRemoteBranch(value) {
  const name = String(value ?? '').trim()
  if (!/^[A-Za-z0-9._/-]{1,80}$/.test(name) || name.startsWith('-') || name.includes('..')) {
    throw Object.assign(new Error('分支名不合法'), { code: 'bad-argument' })
  }
  return name
}

export async function remoteCheckoutRef(info, ref) {
  const out = await gitOrThrow(info, ['checkout', '--detach', assertRemoteRef(ref)])
  return { output: out.trim().split('\n').slice(-1)[0] || '已检出' }
}

export async function remoteCreateBranch(info, name, ref) {
  const branch = assertRemoteBranch(name)
  const out = await gitOrThrow(info, ['branch', branch, assertRemoteRef(ref)])
  return { output: out.trim() || `已创建分支 ${branch}` }
}

export async function remoteRevertCommit(info, ref) {
  const out = await gitOrThrow(info, ['revert', '--no-edit', assertRemoteRef(ref)])
  return { output: out.trim().split('\n').slice(-1)[0] || '已撤销提交' }
}
