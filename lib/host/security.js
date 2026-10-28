/**
 * 访问控制。
 *
 * 这是一个要发布到插件市场的插件：它的路由能读写用户磁盘上的文件，
 * 所以默认只接受「本机回环 + 同源」的请求。两条都挡住，才能防止
 * 局域网内的另一台机器、或用户浏览器里别的网页拿 DSH 当文件服务器用。
 */

/** 只接受回环地址发起的请求 */
export function isLoopback(req) {
  const raw = (req.socket && req.socket.remoteAddress) || ''
  return /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(raw)
}

/**
 * 同源检查。浏览器请求带 Origin；Electron 自定义协议下可能是 `dsh-app://app`
 * 或 `null`，这两种都放行（它们同样只可能来自 DSH 自己的页面）。
 * 没有 Origin 的请求（curl / 探针 / Node 端调用）由回环检查负责。
 */
export function isSameOrigin(req) {
  const origin = req.headers.origin
  if (!origin || origin === 'null') return true
  let parsed
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }
  if (parsed.protocol === 'dsh-app:' || parsed.protocol === 'app:') return true
  const host = req.headers.host || ''
  return parsed.host === host
}

/** 统一的前置校验：通过返回 null，拦截返回错误响应 */
export function guard(req, res, fail) {
  if (!isLoopback(req)) {
    fail(res, 'forbidden', 'loopback only', 403)
    return false
  }
  if (!isSameOrigin(req)) {
    fail(res, 'forbidden', 'cross-origin request rejected', 403)
    return false
  }
  return true
}
