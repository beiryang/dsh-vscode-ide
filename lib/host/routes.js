/**
 * 路由装配：/dsh-vscode-ide/*
 *
 *   GET  /dsh-vscode-ide/health        宿主存活 + 运行信息（探针用）
 *   GET  /dsh-vscode-ide/assets/*      静态资源（探针 worker；Phase 1 起放 Monaco）
 *   POST /dsh-vscode-ide/api/info      { sessionId } → 版本与工作目录
 *   POST /dsh-vscode-ide/api/roots     { sessionId } → { cwd }
 *   POST /dsh-vscode-ide/api/list      { sessionId, path }
 *   POST /dsh-vscode-ide/api/read      { sessionId, path }
 *   POST /dsh-vscode-ide/api/stat      { sessionId, path }
 *   POST /dsh-vscode-ide/api/write     { sessionId, path, text, bom? }
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fail, ok, readJson } from './http.js'
import { guard } from './security.js'
import { importIconTheme, importTheme } from './custom-assets.js'
import { replaceContent, searchContent } from './search.js'
import { listDir, readText, searchFiles, statPath, workspaceCwd, writeText } from './fsapi.js'
import { listDir as remoteList, readText as remoteRead, remoteInfo, searchFiles as remoteSearch, statPath as remoteStat, writeText as remoteWrite } from './remote-fs.js'
import {
  commit as gitCommit,
  commitFile as gitCommitFile,
  commitInfo as gitCommitInfo,
  fetchRemote as gitFetch,
  findRepos,
  pull as gitPull,
  discard as gitDiscard,
  headContent,
  log as gitLog,
  push as gitPush,
  stage as gitStage,
  stageAll as gitStageAll,
  status as gitStatus,
  unstage as gitUnstage,
  unstageAll as gitUnstageAll
} from './git.js'
import { attachStream, closeSession, openLocal, openSession, remoteMetaForCwd, resizeSession, writeSession } from './terminal.js'
import {
  remoteCommit,
  remoteCommitFile,
  remoteCommitInfo,
  remoteFetch,
  remoteFindRepos,
  remotePull,
  withGitDir,
  remoteDiscard,
  remoteHeadContent,
  remoteLog,
  remotePush,
  remoteStage,
  remoteStageAll,
  remoteStatus,
  remoteUnstage,
  remoteUnstageAll
} from './remote-git.js'
import { serveAsset } from './static.js'

export const PREFIX = '/dsh-vscode-ide'

/** 工作区内的 Git 目录（相对路径 → 绝对路径，越界拒绝） */
function localGitCwd(root, gitDir) {
  if (typeof gitDir !== 'string' || !gitDir.trim()) return root
  const target = resolve(root, gitDir.trim())
  const rel = relative(root, target)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Git 目录必须位于工作区内')
  return target
}

export function registerRoutes(ctx, meta) {
  const here = dirname(fileURLToPath(import.meta.url)) // <pkg>/lib/host
  const vendorDir = join(here, '..', '..', 'vendor')

  const handler = async (req, res) => {
    try {
      if (!guard(req, res, fail)) return

      const url = new URL(req.url || '/', 'http://dsv.local')
      const pathname = url.pathname

      if (pathname === PREFIX || `${pathname}/` === `${PREFIX}/`) {
        return ok(res, { ...meta, alive: true })
      }
      if (!pathname.startsWith(PREFIX + '/')) {
        return fail(res, 'not-found', 'unknown route', 404)
      }

      const rest = pathname.slice(PREFIX.length + 1)

      if (rest === 'health' || rest === 'ping') {
        return ok(res, {
          ...meta,
          alive: true,
          pid: process.pid,
          node: process.version,
          platform: process.platform,
          cwd: process.cwd(),
          uptime: Math.round(process.uptime())
        })
      }

      if (rest.startsWith('assets/')) {
        return serveAsset(req, res, vendorDir, rest.slice('assets/'.length), fail)
      }

      // 终端输出流（NDJSON）：必须走 GET + 长连接，不能套 readJson
      if (rest === 'term/stream') {
        if (req.method !== 'GET') return fail(res, 'method', 'GET only', 405)
        const id = url.searchParams.get('id') || ''
        if (!attachStream(id, req, res)) return fail(res, 'not-found', 'terminal session not found', 404)
        return
      }

      if (rest.startsWith('api/')) {
        if (req.method !== 'POST') return fail(res, 'method', 'POST only', 405)
        const payload = await readJson(req)
        return await handleApi(ctx, rest.slice(4), payload, res, meta)
      }

      return fail(res, 'not-found', 'unknown route: ' + rest, 404)
    } catch (error) {
      const code = (error && error.code) || 'internal'
      const status = code === 'outside' ? 403 : code === 'no-workspace' ? 409 : code === 'too-large' ? 413 : 500
      const message = (error && error.message) || String(error)
      if (status === 500 && ctx.logger && typeof ctx.logger.warn === 'function') {
        ctx.logger.warn(`[dsh-vscode-ide] ${code}: ${message}`)
      }
      return fail(res, code, message, status)
    }
  }

  return ctx.webServer.register({ kind: 'prefix', path: PREFIX, handler })
}

async function handleApi(ctx, method, payload, res, meta) {
  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : ''

  if (method === 'info') {
    return ok(res, { ...meta, sessionId: sessionId || null, cwd: workspaceCwd(ctx, sessionId) })
  }

  // 探针结果落盘：省去复制粘贴，出问题时直接把路径给维护者
  if (method === 'probe') {
    if (!payload.result || typeof payload.result !== 'object') {
      return fail(res, 'bad-argument', 'result is required', 400)
    }
    const dir = join(tmpdir(), 'dsv-probe')
    await mkdir(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const file = join(dir, `probe-${stamp}.json`)
    await writeFile(file, JSON.stringify(payload.result, null, 2), 'utf8')
    return ok(res, { path: file })
  }

  // 主题 / 图标导入：与工作区无关，必须在 workspaceCwd 检查之前处理
  if (method === 'theme/import') return ok(res, await importTheme(payload.path))
  if (method === 'icons/import') return ok(res, await importIconTheme(payload.path))

  const root = workspaceCwd(ctx, sessionId)
  if (!root) {
    return fail(res, 'no-workspace', '当前会话没有工作区：请先在 DSH 里打开一个会话', 409)
  }

  // 远程工作区：文件域全部走 SFTP（会话 cwd 是本地镜像，但真正的文件在服务器上）
  const remote = await remoteInfo(root)
  const files = remote
    ? {
        list: (path) => remoteList(remote, path),
        read: (path) => remoteRead(remote, path),
        stat: (path) => remoteStat(remote, path),
        write: (path, text, options) => remoteWrite(remote, path, text, options),
        search: (options) => remoteSearch(remote, options)
      }
    : {
        list: (path) => listDir(root, path),
        read: (path) => readText(root, path),
        stat: (path) => statPath(root, path),
        write: (path, text, options) => writeText(root, path, text, options),
        search: (options) => searchFiles(root, options)
      }

  switch (method) {
    case 'roots':
      return ok(res, { cwd: root, remote: Boolean(remote), remoteRoot: remote ? remote.remoteRoot : null })
    case 'search':
      return ok(res, await files.search(payload))
    case 'search/content': {
      // 远程工作区暂不支持：SFTP 逐文件读会非常慢（后续用远端 grep 补）
      if (remote) return fail(res, 'remote-unsupported', '远程工作区暂不支持内容搜索（会在后续版本用远端 grep 支持）', 409)
      return ok(res, await searchContent(root, payload))
    }
    case 'replace/content': {
      if (remote) return fail(res, 'remote-unsupported', '远程工作区暂不支持内容替换', 409)
      return ok(res, await replaceContent(root, payload))
    }
    case 'list':
      return ok(res, await files.list(payload.path))
    case 'read':
      return ok(res, await files.read(payload.path))
    case 'stat':
      return ok(res, await files.stat(payload.path))
    case 'write': {
      if (typeof payload.text !== 'string') return fail(res, 'bad-argument', 'text is required', 400)
      return ok(res, await files.write(payload.path, payload.text, { bom: payload.bom === true }))
    }
    case 'theme/import':
      return ok(res, await importTheme(payload.path))
    case 'icons/import':
      return ok(res, await importIconTheme(payload.path))
    case 'git/status': {
      const gitDir = payload.gitDir
      if (remote) return ok(res, await remoteStatus(withGitDir(remote, gitDir)))
      const localCwd = localGitCwd(root, gitDir)
      const result = await gitStatus(localCwd)
      // 工作区只是仓库的一个子目录时，只保留工作区内的变更（否则会列出打不开的文件）
      result.changes = result.changes.filter((change) => {
        const rel = relative(root, change.absPath)
        return !rel.startsWith('..') && !isAbsolute(rel)
      })
      return ok(res, result)
    }
    case 'git/candidates': {
      const repos = remote ? await remoteFindRepos(remote) : await findRepos(root)
      return ok(res, { repos, remote: Boolean(remote) })
    }
    case 'git/log': {
      const gitDir = payload.gitDir
      const localCwd = remote ? null : localGitCwd(root, gitDir)
      return ok(res, remote ? await remoteLog(withGitDir(remote, gitDir), payload.limit) : await gitLog(localCwd, payload.limit))
    }
    case 'git/head': {
      if (typeof payload.path !== 'string' || !payload.path) {
        return fail(res, 'bad-argument', 'path is required', 400)
      }
      const gitDir = payload.gitDir
      const localCwd = remote ? null : localGitCwd(root, gitDir)
      return ok(
        res,
        remote
          ? await remoteHeadContent(withGitDir(remote, gitDir), payload.path)
          : await headContent(localCwd, payload.path)
      )
    }
    case 'git/stage': {
      const gitDir = payload.gitDir
      const localCwd = remote ? null : localGitCwd(root, gitDir)
      return ok(res, remote ? await remoteStage(withGitDir(remote, gitDir), payload.paths) : await gitStage(localCwd, payload.paths))
    }
    case 'git/unstage': {
      const gitDir = payload.gitDir
      const localCwd = remote ? null : localGitCwd(root, gitDir)
      return ok(
        res,
        remote ? await remoteUnstage(withGitDir(remote, gitDir), payload.paths) : await gitUnstage(localCwd, payload.paths)
      )
    }
    case 'git/stageAll': {
      const gitDir = payload.gitDir
      const localCwd = remote ? null : localGitCwd(root, gitDir)
      return ok(res, remote ? await remoteStageAll(withGitDir(remote, gitDir)) : await gitStageAll(localCwd))
    }
    case 'git/unstageAll': {
      const gitDir = payload.gitDir
      const localCwd = remote ? null : localGitCwd(root, gitDir)
      return ok(res, remote ? await remoteUnstageAll(withGitDir(remote, gitDir)) : await gitUnstageAll(localCwd))
    }
    case 'git/commit': {
      const gitDir = payload.gitDir
      const localCwd = remote ? null : localGitCwd(root, gitDir)
      return ok(
        res,
        remote ? await remoteCommit(withGitDir(remote, gitDir), payload.message) : await gitCommit(localCwd, payload.message)
      )
    }
    case 'git/discard': {
      const gitDir = payload.gitDir
      const localCwd = remote ? null : localGitCwd(root, gitDir)
      return ok(
        res,
        remote
          ? await remoteDiscard(withGitDir(remote, gitDir), payload.paths ?? [], payload.untracked ?? [])
          : await gitDiscard(localCwd, payload.paths ?? [], payload.untracked ?? [])
      )
    }
    case 'git/commit-info': {
      const gitDir = payload.gitDir
      const localCwd = remote ? null : localGitCwd(root, gitDir)
      return ok(
        res,
        remote ? await remoteCommitInfo(withGitDir(remote, gitDir), payload.hash) : await gitCommitInfo(localCwd, payload.hash)
      )
    }
    case 'git/commit-file': {
      const gitDir = payload.gitDir
      const localCwd = remote ? null : localGitCwd(root, gitDir)
      return ok(
        res,
        remote
          ? await remoteCommitFile(withGitDir(remote, gitDir), payload.hash, payload.path)
          : await gitCommitFile(localCwd, payload.hash, payload.path)
      )
    }
    case 'git/pull': {
      const gitDir = payload.gitDir
      const localCwd = remote ? null : localGitCwd(root, gitDir)
      return ok(res, remote ? await remotePull(withGitDir(remote, gitDir)) : await gitPull(localCwd))
    }
    case 'git/fetch': {
      const gitDir = payload.gitDir
      const localCwd = remote ? null : localGitCwd(root, gitDir)
      return ok(res, remote ? await remoteFetch(withGitDir(remote, gitDir)) : await gitFetch(localCwd))
    }
    case 'git/push': {
      const gitDir = payload.gitDir
      const localCwd = remote ? null : localGitCwd(root, gitDir)
      return ok(res, remote ? await remotePush(withGitDir(remote, gitDir)) : await gitPush(localCwd))
    }
    case 'term/open':
      return ok(res, await openSession(root, { cols: payload.cols, rows: payload.rows, ssh: payload.ssh }))
    case 'ssh/info':
      // 当前会话若是远程工作区，返回它的连接参数，给「＋SSH」对话框预填
      return ok(res, (await remoteMetaForCwd(root)) ?? null)
    case 'local/open':
      return ok(res, await openLocal(root, { shell: payload.shell }))
    case 'term/write':
      if (typeof payload.id !== 'string' || typeof payload.data !== 'string') {
        return fail(res, 'bad-argument', 'id and data are required', 400)
      }
      return ok(res, { written: writeSession(payload.id, payload.data) })
    case 'term/resize':
      return ok(res, { resized: resizeSession(payload.id, payload.cols, payload.rows) })
    case 'term/close':
      return ok(res, { closed: closeSession(payload.id) })
    default:
      return fail(res, 'not-found', 'unknown api: ' + method, 404)
  }
}
