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
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fail, ok, readJson } from './http.js'
import { guard } from './security.js'
import { importIconTheme, importTheme } from './custom-assets.js'
import { replaceContent, searchContent } from './search.js'
import { listDir, readText, searchFiles, statPath, workspaceCwd, writeText } from './fsapi.js'
import { listDir as remoteList, readText as remoteRead, remoteInfo, searchFiles as remoteSearch, statPath as remoteStat, writeText as remoteWrite } from './remote-fs.js'
import {
  commit as gitCommit,
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
    case 'git/status':
      return ok(res, remote ? await remoteStatus(remote) : await gitStatus(root))
    case 'git/log':
      return ok(res, remote ? await remoteLog(remote, payload.limit) : await gitLog(root, payload.limit))
    case 'git/head': {
      if (typeof payload.path !== 'string' || !payload.path) {
        return fail(res, 'bad-argument', 'path is required', 400)
      }
      return ok(res, remote ? await remoteHeadContent(remote, payload.path) : await headContent(root, payload.path))
    }
    case 'git/stage':
      return ok(res, remote ? await remoteStage(remote, payload.paths) : await gitStage(root, payload.paths))
    case 'git/unstage':
      return ok(res, remote ? await remoteUnstage(remote, payload.paths) : await gitUnstage(root, payload.paths))
    case 'git/stageAll':
      return ok(res, remote ? await remoteStageAll(remote) : await gitStageAll(root))
    case 'git/unstageAll':
      return ok(res, remote ? await remoteUnstageAll(remote) : await gitUnstageAll(root))
    case 'git/commit':
      return ok(res, remote ? await remoteCommit(remote, payload.message) : await gitCommit(root, payload.message))
    case 'git/discard':
      return ok(
        res,
        remote
          ? await remoteDiscard(remote, payload.paths ?? [], payload.untracked ?? [])
          : await gitDiscard(root, payload.paths ?? [], payload.untracked ?? [])
      )
    case 'git/push':
      return ok(res, remote ? await remotePush(remote) : await gitPush(root))
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
