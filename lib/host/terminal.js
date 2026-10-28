/**
 * 终端会话（宿主半边）：SSH 终端 + 本地 PowerShell 命令控制台。
 *
 * 传输走「HTTP 流 + POST 输入」，不走 WebSocket：
 * DSH 的 webServer 是否支持 upgrade 未知，而 chunked fetch 我们已经验证过能通。
 *
 * 输出用 NDJSON（每行一个 JSON），二进制统一 base64，避免控制序列在 JSON 里出问题：
 *   {"t":"d","d":"<base64>"}  终端输出
 *   {"t":"x"}                 会话结束
 *   {"t":"ping"}              保活（15s）
 *
 * 两类会话共用一个注册表，所以输出流只写一套：
 *   - ssh   ：ssh2 shell 通道，走真 PTY，按原始字节收发
 *   - local ：本地 PowerShell 的 stdin/stdout 管道。**不是 PTY**，
 *             没有回显与行编辑，所以客户端用「输入行 + 输出区」而不是 xterm。
 *
 * SSH 连接信息复用 dsh-remote-ssh 的工作区元数据：
 *   ~/.dsh/remote-workspaces/<id>/.remote-ssh.json
 * 所以「远程工作区会话 → 终端」是零配置的。
 */

import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const sessions = new Map()
const BUFFER_LIMIT = 2 * 1024 * 1024

/**
 * 优先用 profile 里装的 ssh2；没有就退回插件自带的 vendor 副本
 * （开发期用 raw copy 安装时，profile 里不会有 ssh2）。
 */
async function loadSsh2() {
  try {
    return await import('ssh2')
  } catch {
    const here = dirname(fileURLToPath(import.meta.url))
    const vendored = join(here, '..', '..', 'vendor', 'node_modules', 'ssh2', 'lib', 'index.js')
    return import(pathToFileURL(vendored).href)
  }
}

function dshHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

/** 从会话 cwd 里认出 remote-workspaces/<id>，再读它的连接元数据 */
export async function remoteMetaForCwd(cwd) {
  if (typeof cwd !== 'string' || !cwd) return null
  const match = /remote-workspaces[\\/]+([^\\/]+)/i.exec(cwd)
  if (!match) return null
  try {
    const file = join(dshHome(), 'remote-workspaces', match[1], '.remote-ssh.json')
    const meta = JSON.parse(await readFile(file, 'utf8'))
    if (!meta || typeof meta.host !== 'string' || !meta.host) return null
    return {
      host: meta.host,
      port: Number(meta.port) || 22,
      user: meta.user,
      keyPath: meta.keyPath,
      remotePath: meta.remotePath || '~',
      proxyJump: meta.proxyJump
    }
  } catch {
    return null
  }
}

/** `~/.ssh/id_ed25519` → 本机绝对路径 */
function expandHome(path) {
  if (typeof path !== 'string' || !path) return ''
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2))
  return path
}

function push(session, chunk) {
  if (session.sink) {
    session.sink(chunk)
    return
  }
  if (session.buffer.length > 4096) return
  session.buffered += chunk.length
  if (session.buffered > BUFFER_LIMIT) {
    session.buffer = []
    session.buffered = 0
    return
  }
  session.buffer.push(chunk)
}

/**
 * 本地 PowerShell 的输出编码取决于 Windows 代码页（中文系统是 GBK），
 * 而 SSH 侧是 UTF-8。这里按「整行」判断编码：先按 UTF-8 严格解码，
 * 失败就退到 GBK，再把结果统一成 UTF-8 送给前端。
 */
function decodeLocalLine(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    try {
      return new TextDecoder('gbk').decode(buffer)
    } catch {
      return buffer.toString('utf8')
    }
  }
}

export async function openSession(cwd, options = {}) {
  const meta = await remoteMetaForCwd(cwd)
  if (!meta) {
    throw Object.assign(new Error('当前会话不是远程工作区，暂时只能开 SSH 终端'), { code: 'no-remote' })
  }

  const ssh2 = await loadSsh2()
  const client = new ssh2.Client()
  const cols = Math.min(Math.max(Number(options.cols) || 100, 20), 500)
  const rows = Math.min(Math.max(Number(options.rows) || 30, 5), 200)

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
    if (!meta.keyPath) {
      clearTimeout(timer)
      reject(new Error('该工作区没有配置私钥（keyPath），暂时无法建立 SSH 终端'))
      return
    }
    try {
      config.privateKey = readFileSync(expandHome(meta.keyPath))
    } catch (error) {
      clearTimeout(timer)
      reject(new Error(`读取私钥失败：${error.message}`))
      return
    }
    try {
      client.connect(config)
    } catch (error) {
      clearTimeout(timer)
      reject(error)
    }
  })

  const stream = await new Promise((resolve, reject) => {
    client.shell({ term: 'xterm-256color', cols, rows }, (error, channel) => {
      if (error) reject(new Error(`打开 shell 失败：${error.message}`))
      else resolve(channel)
    })
  })

  const id = randomUUID()
  const session = {
    id,
    client,
    stream,
    sink: null,
    buffer: [],
    buffered: 0,
    closed: false,
    label: `${meta.user || 'ssh'}@${meta.host}`,
    meta
  }

  stream.on('data', (chunk) => push(session, chunk))
  stream.on('close', () => {
    session.closed = true
    push(session, Buffer.from('\r\n\x1b[90m[会话已结束]\x1b[0m\r\n'))
    try {
      client.end()
    } catch {
      /* ignore */
    }
  })
  stream.stderr?.on('data', (chunk) => push(session, chunk))

  sessions.set(id, session)
  return { id, label: session.label }
}

export function attachStream(id, req, res) {
  const session = sessions.get(id)
  if (!session) return false

  res.writeHead(200, {
    'content-type': 'application/x-ndjson; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
    'x-accel-buffering': 'no'
  })

  const send = (payload) => {
    try {
      res.write(`${JSON.stringify(payload)}\n`)
    } catch {
      /* 客户端断开 */
    }
  }
  const sink = (chunk) => send({ t: 'd', d: Buffer.from(chunk).toString('base64') })

  // 先把没订阅前攒下的输出冲出去，避免丢开头（比如 motd / 提示符）
  for (const chunk of session.buffer) sink(chunk)
  session.buffer = []
  session.buffered = 0
  session.sink = sink

  if (session.closed) send({ t: 'x' })

  const keepalive = setInterval(() => send({ t: 'ping' }), 15000)
  const cleanup = () => {
    clearInterval(keepalive)
    if (session.sink === sink) session.sink = null
  }
  // 有的环境下 req 不会收到 close，res 一定会——两处都挂，避免保活定时器泄漏
  req.on('close', cleanup)
  res.on?.('close', cleanup)
  return true
}

export function writeSession(id, data) {
  const session = sessions.get(id)
  if (!session || session.closed) return false
  try {
    // 本地会话是「命令控制台」：一次写一整行（base64，由 PowerShell 侧解码）
    if (session.kind === 'local') {
      session.stream.stdin.write(`${Buffer.from(data, 'utf8').toString('base64')}\r\n`)
      return true
    }
    session.stream.write(data)
    return true
  } catch {
    return false
  }
}

/** 本地命令控制台的可执行文件：优先 pwsh 7，退回系统自带 5.1 */
function pickPowerShell() {
  const candidates = [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    'C:\\Program Files\\PowerShell\\7-preview\\pwsh.exe'
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return { command: candidate, label: 'PowerShell 7' }
  }
  return { command: 'powershell.exe', label: 'Windows PowerShell' }
}

/**
 * 本地会话的自建 REPL。
 *
 * 为什么不直接 `powershell -Command -`：那样 stdin 会按系统代码页（中文是 GBK）
 * 解码，我们发 UTF-8 过去会被读成乱码再执行 —— 表现就是「命令变成乱码」。
 * 这里改成：每行都是一段 base64（纯 ASCII），由 PowerShell 自己解码成 UTF-8 再
 * Invoke-Expression，输入输出编码都统一到 UTF-8。
 */
const LOCAL_BOOTSTRAP =
  '[Console]::OutputEncoding=[Text.Encoding]::UTF8; while($true){$l=[Console]::In.ReadLine(); ' +
  'if($null -eq $l){break}; try{ $r = Invoke-Expression ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($l))); ' +
  'if ($null -ne $r) { $r | Out-String -Width 200 } } catch { Write-Output $_.Exception.Message } }'

/**
 * 打开本地命令控制台。
 * 注意：走 stdin/stdout 管道，没有 PTY —— 不能跑 vim/top 这类全屏程序，
 * 也不会有行编辑与输入回显（客户端用「输入行 + 输出区」的形态呈现）。
 */
export async function openLocal(cwd, options = {}) {
  const shell = pickPowerShell()
  const child = spawn(shell.command, ['-NoLogo', '-NoProfile', '-Command', LOCAL_BOOTSTRAP], {
    cwd,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  })

  const id = randomUUID()
  const session = {
    id,
    kind: 'local',
    stream: child,
    sink: null,
    buffer: [],
    buffered: 0,
    closed: false,
    label: shell.label,
    meta: { shell: shell.command, cwd }
  }

  const pushLocal = (chunk) => {
    // 按行聚合，保证多字节字符不会被 chunk 边界劈开
    session.pending = Buffer.concat([session.pending ?? Buffer.alloc(0), chunk])
    const at = session.pending.lastIndexOf(0x0a)
    if (at === -1) {
      if (session.pending.length > 64 * 1024) {
        // 极端情况：长时间没有换行，直接吐出去避免无限堆积
        push(session, Buffer.from(decodeLocalLine(session.pending), 'utf8'))
        session.pending = Buffer.alloc(0)
      }
      return
    }
    const complete = session.pending.subarray(0, at + 1)
    session.pending = session.pending.subarray(at + 1)
    push(session, Buffer.from(decodeLocalLine(complete), 'utf8'))
  }
  child.stdout.on('data', pushLocal)
  child.stderr.on('data', pushLocal)
  child.on('error', (error) => {
    pushLocal(Buffer.from(`\r\n[启动失败] ${error.message}\r\n`))
    session.closed = true
  })
  child.on('close', () => {
    session.closed = true
    if (session.pending && session.pending.length > 0) {
      push(session, Buffer.from(decodeLocalLine(session.pending), 'utf8'))
      session.pending = Buffer.alloc(0)
    }
    pushLocal(Buffer.from('\r\n[已退出]\r\n'))
  })

  // 输入编码已经在 bootstrap 里处理（base64 + UTF-8 自解码），这里不用再写前置命令

  sessions.set(id, session)
  return { id, label: session.label, shell: shell.command }
}


export function resizeSession(id, cols, rows) {
  const session = sessions.get(id)
  if (!session || session.closed) return false
  if (session.kind === 'local') return false // 本地控制台没有 PTY，不需要窗口大小
  try {
    session.stream.setWindow(Math.max(Number(rows) || 24, 5), Math.max(Number(cols) || 80, 20), 0, 0)
    return true
  } catch {
    return false
  }
}

export function closeSession(id) {
  const session = sessions.get(id)
  if (!session) return false
  sessions.delete(id)
  try {
    if (session.kind === 'local') {
      session.stream.kill()
    } else {
      session.stream.close()
      session.client.end()
    }
  } catch {
    /* ignore */
  }
  return true
}

export function disposeAll() {
  for (const id of [...sessions.keys()]) closeSession(id)
}
