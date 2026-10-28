/**
 * 静态资源服务：/dsh-vscode-ide/assets/* → <package>/vendor/*
 *
 * Phase 0 只放探针 worker；Phase 1 起这里会放 Monaco 的 AMD 发行版
 * （loader.js / editor.main / style.css / *.worker.js / 语言包）。
 * 文件名不带内容 hash，所以默认 no-cache；Monaco 目录单独给长缓存，
 * 升级时改目录名（vendor/monaco/<version>/）来失效。
 */

import { existsSync } from 'node:fs'
import { join, normalize, sep } from 'node:path'

import { contentTypeOf, serveFile } from './http.js'

/** 解析包根目录：<pkg>/lib/host/static.js → <pkg> */
export function packageRoot(fromFileUrl) {
  return normalize(join(fromFileUrl, '..', '..', '..'))
}

function safeJoin(vendorDir, relative) {
  const cleaned = relative.replace(/\\/g, '/').replace(/^\/+/, '')
  if (cleaned.split('/').some((part) => part === '..' || part === '')) return null
  const abs = normalize(join(vendorDir, ...cleaned.split('/')))
  const rootn = process.platform === 'win32' ? vendorDir.toLowerCase() : vendorDir
  const absn = process.platform === 'win32' ? abs.toLowerCase() : abs
  if (absn !== rootn && !absn.startsWith(rootn + sep)) return null
  return abs
}

/**
 * @returns {boolean} true 表示已经响应（或已 404），false 表示不是静态路由
 */
export function serveAsset(req, res, vendorDir, relative, fail) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    fail(res, 'method', 'GET only', 405)
    return true
  }
  const abs = safeJoin(vendorDir, relative)
  if (abs === null) {
    fail(res, 'bad-path', 'invalid asset path', 400)
    return true
  }
  if (!existsSync(abs)) {
    fail(res, 'not-found', 'asset not found: ' + relative, 404)
    return true
  }
  const cache = abs.includes(`${sep}monaco${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache'
  const served = serveFile(req, res, abs, cache)
  if (!served) fail(res, 'not-found', 'asset is not a file: ' + relative, 404)
  return true
}

export { contentTypeOf }
