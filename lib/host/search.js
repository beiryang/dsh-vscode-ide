/**
 * 全局内容搜索（在文件中搜索）。
 *
 * 策略：
 *   1. 是 Git 仓库 → `git grep`（快、自带二进制跳过、无需遍历）
 *   2. 否则 → 自己遍历（跳过 node_modules/.git 等、跳过二进制与超大文件）
 *
 * 返回结构固定，客户端不用关心走的哪条路；`engine` 只用于界面上提示。
 */

import { execFile } from 'node:child_process'
import { readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

const MAX_RESULTS = 500
const MAX_FILES = 4000
const MAX_FILE_BYTES = 1024 * 1024
const MAX_MATCHES_PER_FILE = 50
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'out',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.cache',
  '.venv',
  'venv',
  '__pycache__',
  '.idea',
  '.vscode',
  'target',
  'bin',
  'obj'
])

/** 极简 glob：* 匹配任意非分隔符，** 匹配任意层级，? 匹配单字符；逗号/分号分隔多个 */
function globToRegExp(glob) {
  let out = ''
  const text = glob.trim().replace(/\\/g, '/')
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '*') {
      if (text[index + 1] === '*') {
        out += '.*'
        index += 1
        if (text[index + 1] === '/') index += 1
      } else {
        out += '[^/]*'
      }
    } else if (char === '?') {
      out += '[^/]'
    } else {
      out += char.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp(`^${out}$`, 'i')
}

function globFilter(includeText, excludeText) {
  const parse = (value) =>
    String(value ?? '')
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map(globToRegExp)
  const includes = parse(includeText)
  const excludes = parse(excludeText)
  if (includes.length === 0 && excludes.length === 0) return () => true
  return (rel) => {
    const path = String(rel).split('\\').join('/')
    if (excludes.some((rule) => rule.test(path))) return false
    if (includes.length === 0) return true
    return includes.some((rule) => rule.test(path))
  }
}

function bad(message) {
  return Object.assign(new Error(message), { code: 'bad-argument' })
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { maxBuffer: 16 * 1024 * 1024, windowsHide: true, ...options },
      (error, stdout) => resolve({ ok: !error, stdout: stdout ?? '' })
    )
  })
}

function normalizeRel(root, base, filePath) {
  return relative(base, filePath).split(sep).join('/')
}

function toMatch(root, base, absolute, line, text) {
  return {
    path: absolute,
    rel: normalizeRel(root, base, absolute),
    line,
    text: text.length > 400 ? `${text.slice(0, 400)}…` : text
  }
}

function isProbablyBinary(buffer) {
  const limit = Math.min(buffer.length, 8192)
  for (let index = 0; index < limit; index += 1) {
    if (buffer[index] === 0) return true
  }
  return false
}

/** 用 git grep 搜索（仓库根可能不是工作区根） */
async function gitGrep(root, options) {
  const inside = await run('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'])
  if (!inside.ok || inside.stdout.trim() !== 'true') return null

  const top = await run('git', ['-C', root, 'rev-parse', '--show-toplevel'])
  if (!top.ok) return null
  const repoRoot = top.stdout.trim()

  const args = ['-C', repoRoot, 'grep', '-n', '-I', '--no-color']
  if (options.regex) args.push('-E')
  else args.push('-F')
  if (!options.caseSensitive) args.push('-i')
  if (options.wholeWord) args.push('-w')
  args.push('-e', options.query, '--', '.')

  const result = await run('git', args)
  // 退出码 1 = 没有匹配，不算错误
  if (!result.ok && result.stdout.trim() === '') return { matches: [], truncated: false, repoRoot }

  const matches = []
  let truncated = false
  for (const raw of result.stdout.split(/\r?\n/)) {
    if (!raw) continue
    const first = raw.indexOf(':')
    if (first <= 0) continue
    const second = raw.indexOf(':', first + 1)
    if (second <= 0) continue
    const relPath = raw.slice(0, first)
    const lineNumber = Number.parseInt(raw.slice(first + 1, second), 10)
    if (!Number.isFinite(lineNumber)) continue
    const absolute = join(repoRoot, relPath)
    matches.push(toMatch(root, root, absolute, lineNumber, raw.slice(second + 1)))
    if (matches.length >= MAX_RESULTS) {
      truncated = true
      break
    }
  }
  return { matches, truncated, repoRoot }
}

/** 遍历搜索（非 Git 仓库、或者 git 不可用） */
async function walkGrep(root, options) {
  const pattern = buildMatcher(options)
  const matches = []
  let truncated = false
  let scanned = 0
  const queue = [root]

  while (queue.length) {
    const dir = queue.shift()
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const absolute = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        if (entry.name.startsWith('.') && entry.name !== '.github') continue
        queue.push(absolute)
        continue
      }
      if (!entry.isFile()) continue
      scanned += 1
      if (scanned > MAX_FILES) {
        truncated = true
        break
      }
      let info
      try {
        info = await stat(absolute)
      } catch {
        continue
      }
      if (info.size > MAX_FILE_BYTES) continue
      let text
      try {
        const buffer = await readFile(absolute)
        if (isProbablyBinary(buffer)) continue
        text = buffer.toString('utf8')
      } catch {
        continue
      }
      let hits = 0
      const lines = text.split(/\r?\n/)
      for (let index = 0; index < lines.length; index += 1) {
        if (!pattern.test(lines[index])) continue
        matches.push(toMatch(root, root, absolute, index + 1, lines[index].trim()))
        hits += 1
        if (hits >= MAX_MATCHES_PER_FILE) break
        if (matches.length >= MAX_RESULTS) break
      }
      if (matches.length >= MAX_RESULTS) {
        truncated = true
        break
      }
    }
    if (truncated) break
  }
  return { matches, truncated, scanned }
}

function buildGlobalMatcher(options) {
  const base = buildMatcher(options)
  return new RegExp(base.source, base.flags.includes('g') ? base.flags : `${base.flags}g`)
}

function buildMatcher(options) {
  if (options.regex) {
    try {
      return new RegExp(options.query, options.caseSensitive ? '' : 'i')
    } catch (error) {
      throw bad(`正则不合法：${error.message}`)
    }
  }
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const body = options.wholeWord ? `\\b${escape(options.query)}\\b` : escape(options.query)
  return new RegExp(body, options.caseSensitive ? '' : 'i')
}

/**
 * @param {string} root 工作区根目录（绝对路径）
 * @param {{query: string, regex?: boolean, caseSensitive?: boolean, wholeWord?: boolean, include?: string, exclude?: string}} options
 */
export async function searchContent(root, options = {}) {
  const query = typeof options.query === 'string' ? options.query.trim() : ''
  if (!query) throw bad('请输入要搜索的内容')
  if (query.length > 200) throw bad('搜索内容太长')

  const normalized = {
    query,
    regex: options.regex === true,
    caseSensitive: options.caseSensitive === true,
    wholeWord: options.wholeWord === true
  }
  const allow = globFilter(options.include, options.exclude)
  // 正则模式下先验证一遍，避免把非法正则交给 git grep 得到含糊的报错
  if (normalized.regex) buildMatcher(normalized)

  const started = Date.now()
  const viaGit = await gitGrep(root, normalized)
  if (viaGit) {
    return {
      engine: 'git',
      root,
      repoRoot: viaGit.repoRoot,
      truncated: viaGit.truncated,
      elapsedMs: Date.now() - started,
      matches: viaGit.matches.filter((match) => allow(match.rel))
    }
  }
  const walked = await walkGrep(root, normalized)
  return {
    engine: 'walk',
    root,
    truncated: walked.truncated,
    scanned: walked.scanned,
    elapsedMs: Date.now() - started,
    matches: walked.matches.filter((match) => allow(match.rel))
  }
}

/**
 * 全部替换：先用 searchContent 找到命中的文件，再逐文件替换。
 * 写盘走「临时文件 + rename」，和编辑器保存同一套原子写。
 */
export async function replaceContent(root, options = {}) {
  const query = typeof options.query === 'string' ? options.query.trim() : ''
  if (!query) throw bad('请输入要搜索的内容')
  if (query.length > 200) throw bad('搜索内容太长')
  const replacement = typeof options.replacement === 'string' ? options.replacement : ''

  const normalized = {
    query,
    regex: options.regex === true,
    caseSensitive: options.caseSensitive === true,
    wholeWord: options.wholeWord === true,
    include: options.include,
    exclude: options.exclude
  }
  const matcher = buildGlobalMatcher(normalized)

  const found = await searchContent(root, normalized)
  const files = [...new Set(found.matches.map((match) => match.path))].slice(0, 200)
  let filesChanged = 0
  let replaced = 0

  for (const file of files) {
    let text
    try {
      text = await readFile(file, 'utf8')
    } catch {
      continue
    }
    matcher.lastIndex = 0
    const count = (text.match(matcher) || []).length
    if (count === 0) continue
    matcher.lastIndex = 0
    const next = text.replace(matcher, normalized.regex ? replacement : () => replacement)
    if (next === text) continue
    const tmp = `${file}.dsv-replace-${process.pid}`
    try {
      await writeFile(tmp, next, 'utf8')
      await rename(tmp, file)
      filesChanged += 1
      replaced += count
    } catch {
      /* 单个文件失败不影响其它文件 */
    }
  }

  return {
    engine: found.engine,
    filesChanged,
    replaced,
    filesScanned: files.length,
    truncated: found.truncated
  }
}
