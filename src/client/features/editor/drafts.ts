/**
 * 未保存草稿（hot exit 的地基）。
 *
 * 存在 localStorage（`dsv:drafts.v1`）——插件被卸载时不会误删其它插件的存储，
 * 重装后草稿还在。每条带上「这份草稿是基于哪个磁盘版本」的 size/mtime，
 * 用来判断打开时磁盘有没有被动过。
 *
 * 预算：单条 512 KB、总量 4 MB，超了按时间淘汰最旧的。
 */

const KEY = 'dsv:drafts.v1'
const MAX_ENTRY = 512 * 1024
const MAX_TOTAL = 4 * 1024 * 1024

export type Draft = {
  text: string
  at: number
  /** 草稿基于的磁盘文件大小 */
  size: number
  /** 草稿基于的磁盘文件 mtime */
  mtimeMs: number
}

type Store = Record<string, Draft>

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {}
  } catch {
    return {}
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* 配额满了就放弃这一条，不影响编辑 */
  }
}

/** 按时间保留最近的，直到总量回到预算内 */
function trim(store: Store): Store {
  const entries = Object.entries(store).sort((a, b) => b[1].at - a[1].at)
  const next: Store = {}
  let total = 0
  for (const [key, draft] of entries) {
    total += draft.text.length
    if (total > MAX_TOTAL) continue
    next[key] = draft
  }
  return next
}

export function getDraft(key: string): Draft | undefined {
  return read()[key]
}

export function putDraft(key: string, draft: Draft) {
  if (draft.text.length > MAX_ENTRY) return
  const store = read()
  store[key] = draft
  write(trim(store))
}

export function removeDraft(key: string) {
  const store = read()
  if (store[key]) {
    delete store[key]
    write(store)
  }
}

export function clearDrafts() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function draftCount(): number {
  return Object.keys(read()).length
}
