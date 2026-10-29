/**
 * Git 只读状态：分支、变更列表、最近提交。
 *
 * 只读——不改仓库、不调用任何写命令（add/commit/push 都还没有）。
 * 「点变更看 diff」用的是 `git show HEAD:<rel>` + 工作区内容，
 * 直接复用 Phase 4 的 Monaco diff 视图，不需要自己渲染补丁文本。
 */

import { api } from '../../kernel/transport'
import { registry } from '../../kernel/registry'

export type GitChange = {
  path: string
  absPath: string
  code: string
  staged: boolean
  from?: string
}

export type GitState = {
  phase: 'idle' | 'loading' | 'ready' | 'error'
  message: string | null
  root: string | null
  branch: string | null
  ahead: number
  behind: number
  changes: GitChange[]
  updatedAt: number
  busy: boolean
  /** 上一轮写操作的结果提示 */
  note: string | null
  /** 当前使用的 Git 目录（相对工作区根，'' = 工作区根） */
  gitRoot: string
  /** 最近的提交（Graph 区块） */
  commits: Array<{ hash: string; author: string; when: string; subject: string; refs: string }>
}

let state: GitState = {
  phase: 'idle',
  message: null,
  root: null,
  branch: null,
  ahead: 0,
  behind: 0,
  changes: [],
  updatedAt: 0,
  busy: false,
  note: null,
  gitRoot: '',
  commits: []
}

const listeners = new Set<() => void>()

const ROOTS_KEY = 'dsv:git.root.v1'
let workspaceCwd: string | null = null

function loadRoots(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ROOTS_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveRoot(cwd: string, root: string) {
  const roots = loadRoots()
  if (root) roots[cwd] = root
  else delete roots[cwd]
  try {
    localStorage.setItem(ROOTS_KEY, JSON.stringify(roots))
  } catch {
    /* ignore */
  }
}

function publish(next: Partial<GitState>) {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

let inflight: Promise<void> | null = null

export const git = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  getSnapshot(): GitState {
    return state
  },

  /** 绑定到工作区（切换工作区时调用），恢复该工作区上次选的 Git 目录 */
  attach(cwd: string | null): void {
    workspaceCwd = cwd
    const root = cwd ? loadRoots()[cwd] ?? '' : ''
    if (root !== state.gitRoot) publish({ gitRoot: root, phase: 'idle', changes: [], branch: null, note: null })
    if (cwd) void git.refresh()
  },

  /** 手动指定 Git 目录（相对工作区根，'' = 工作区根） */
  setRoot(root: string): void {
    const clean = root.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    if (workspaceCwd) saveRoot(workspaceCwd, clean)
    publish({ gitRoot: clean, note: null })
    void git.refresh()
  },

  async refresh(): Promise<void> {
    if (inflight) return inflight
    publish({ phase: 'loading', message: null })
    const logPromise = api.gitLog(20, state.gitRoot).catch(() => ({ root: '', commits: [] }))
    inflight = Promise.all([api.gitStatus(state.gitRoot), logPromise])
      .then(([result, log]) => {
        publish({
          phase: 'ready',
          message: null,
          root: result.root,
          branch: result.branch,
          ahead: result.ahead,
          behind: result.behind,
          changes: result.changes,
          commits: log.commits ?? [],
          updatedAt: Date.now()
        })
      })
      .catch((error) => {
        const raw = error instanceof Error ? error.message : String(error)
        const message = /not a git repository/i.test(raw)
          ? '当前目录不是 Git 仓库'
          : raw.replace(/^fatal:\s*/i, '').trim() || 'Git 状态读取失败'
        publish({
          phase: 'error',
          message,
          root: null,
          branch: null,
          changes: [],
          commits: []
        })
      })
      .finally(() => {
        inflight = null
      })
    await inflight
  },

  /** 打开某个变更的 diff：左 = HEAD，右 = 工作区当前内容 */
  async openChange(change: GitChange): Promise<void> {
    const name = change.path.split('/').pop() ?? change.path
    try {
      const head = await api.gitHead(change.absPath, state.gitRoot)
      let current = ''
      if (change.code !== 'D') {
        try {
          const file = await api.read(change.absPath)
          if (file.binary) {
            publish({ message: `${name} 是二进制文件，暂不支持对比` })
            return
          }
          current = file.text
        } catch {
          current = ''
        }
      }
      registry.openDiff(
        { path: change.absPath, name: `${name} · HEAD`, text: head.exists ? head.text : '' },
        { path: change.absPath, name: `${name} · 工作区`, text: current }
      )
    } catch (error) {
      publish({ message: `对比失败：${error instanceof Error ? error.message : String(error)}` })
    }
  },

  /** 写操作的统一包装：置 busy、跑动作、记结果、刷新状态 */
  async run(label: string, action: () => Promise<unknown>): Promise<void> {
    if (state.busy) return
    publish({ busy: true, note: null })
    try {
      const result = (await action()) as { output?: string } | undefined
      publish({
        busy: false,
        note: result && typeof result.output === 'string' ? result.output : `${label}完成`
      })
      await git.refresh()
    } catch (error) {
      publish({
        busy: false,
        note: `${label}失败：${error instanceof Error ? error.message : String(error)}`
      })
    }
  },

  stage(paths: string[]) {
    return git.run('暂存', () => api.gitStage(paths, state.gitRoot))
  },
  unstage(paths: string[]) {
    return git.run('取消暂存', () => api.gitUnstage(paths, state.gitRoot))
  },
  stageAll() {
    return git.run('暂存全部', () => api.gitStageAll(state.gitRoot))
  },
  unstageAll() {
    return git.run('取消全部暂存', () => api.gitUnstageAll(state.gitRoot))
  },
  commit(message: string) {
    return git.run('提交', () => api.gitCommit(message, state.gitRoot))
  },
  /** 暂存全部后提交（提交下拉里的「提交全部」） */
  async commitAll(message: string) {
    if (state.busy) return
    await git.run('提交全部', async () => {
      await api.gitStageAll()
      return api.gitCommit(message)
    })
  },
  /** 提交并推送（提交下拉里的「提交并推送」） */
  async commitAndPush(message: string) {
    if (state.busy) return
    await git.run('提交并推送', async () => {
      const result = await api.gitCommit(message)
      const pushed = await api.gitPush(state.gitRoot)
      return { output: `${result.output} · ${pushed.output}` }
    })
  },
  /** 放弃更改：已跟踪的还原，未跟踪的删除 */
  discard(paths: string[], untracked: string[] = []) {
    return git.run('放弃更改', () => api.gitDiscard(paths, untracked, state.gitRoot))
  },
  push() {
    return git.run('推送', () => api.gitPush(state.gitRoot))
  },
  pull() {
    return git.run('拉取', () => api.gitPull(state.gitRoot))
  },
  fetch() {
    return git.run('获取远端', () => api.gitFetch(state.gitRoot))
  }
}
