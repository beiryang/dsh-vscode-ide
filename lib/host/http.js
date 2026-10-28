/**
 * 极小的 HTTP 工具层：JSON 响应、请求体解析、静态文件服务。
 *
 * 约定（与插件自身的客户端一致）：
 *   成功 → 200 { ok: true,  value: ... }
 *   失败 → 4xx/5xx { ok: false, error: { code, message } }
 */

import { readFileSync, statSync } from 'node:fs'
import { extname } from 'node:path'

export function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  })
  res.end(body)
}

export function ok(res, value) {
  sendJson(res, 200, { ok: true, value })
}

export function fail(res, code, message, status = 400) {
  sendJson(res, status, { ok: false, error: { code, message } })
}

/** 读取 JSON 请求体（默认上限 8 MiB，够 Monaco 保存大文件用） */
export function readJson(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(Object.assign(new Error('request body too large'), { code: 'too-large' }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(Object.assign(new Error('invalid JSON body'), { code: 'bad-json' }))
      }
    })
    req.on('error', reject)
  })
}

const MIME = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
}

export function contentTypeOf(file) {
  return MIME[extname(file).toLowerCase()] ?? 'application/octet-stream'
}

/**
 * 发送一个静态文件。返回 false 表示文件不存在或不是普通文件，由调用方回 404。
 * 支持 ETag / If-None-Match，避免每次打开编辑器都重下 Monaco。
 */
export function serveFile(req, res, absPath, cacheControl = 'no-cache') {
  let st
  try {
    st = statSync(absPath)
  } catch {
    return false
  }
  if (!st.isFile()) return false

  const etag = `W/"${st.size}-${Math.floor(st.mtimeMs)}"`
  const headers = {
    'content-type': contentTypeOf(absPath),
    'content-length': st.size,
    'cache-control': cacheControl,
    etag,
    'x-content-type-options': 'nosniff'
  }
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers)
    res.end()
    return true
  }
  res.writeHead(200, headers)
  // 一次性读完再写：静态资源最大 5.8 MB（ts.worker），比流式更容易保证
  // 错误处理一致；配合 immutable 缓存，重复请求基本不会发生。
  let body
  try {
    body = readFileSync(absPath)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('not found')
    return true
  }
  res.end(body)
  return true
}
