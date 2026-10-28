/**
 * 快速打开的文件索引（跟随当前会话工作区，5 分钟缓存）。
 * 宿主侧 BFS 浅层优先、跳过 node_modules/.git 等重型目录，有硬上限。
 */

import { api } from './transport'

export type FileHit = { path: string; rel: string; name: string }

let cache: { files: FileHit[]; at: number; truncated: boolean } | null = null
let inflight: Promise<FileHit[]> | null = null

export function cachedFiles(): FileHit[] {
  return cache?.files ?? []
}

export function invalidateFiles() {
  cache = null
}

export async function loadFiles(force = false): Promise<FileHit[]> {
  if (!force && cache && Date.now() - cache.at < 5 * 60 * 1000) return cache.files
  if (inflight) return inflight
  inflight = api
    .search({ limit: 8000 })
    .then((result) => {
      cache = { files: result.files, at: Date.now(), truncated: result.truncated }
      return cache.files
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}
