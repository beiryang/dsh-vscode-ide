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
  note: null
}

const listeners = new Set<() => void>()

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

  async refresh(): Promise<void> {
    if (inflight) return inflight
    publish({ phase: 'loading', message: null })
    inflight = api
      .gitStatus()
      .then((result) => {
        publish({
          phase: 'ready',
          message: null,
          root: result.root,
          branch: result.branch,
          ahead: result.ahead,
          behind: result.behind,
          changes: result.changes,
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
          changes: []
        })
      })
      .finally(() => {
        inflight = null
      })
    return inflight
  },

  /** 打开某个变更的 diff：左 = HEAD，右 = 工作区当前内容 */
  async openChange(change: GitChange): Promise<void> {
    const name = change.path.split('/').pop() ?? change.path
    try {
      const head = await api.gitHead(change.absPath)
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
    return git.run('暂存', () => api.gitStage(paths))
  },
  unstage(paths: string[]) {
    return git.run('取消暂存', () => api.gitUnstage(paths))
  },
  stageAll() {
    return git.run('暂存全部', () => api.gitStageAll())
  },
  unstageAll() {
    return git.run('取消全部暂存', () => api.gitUnstageAll())
  },
  commit(message: string) {
    return git.run('提交', () => api.gitCommit(message))
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
      const pushed = await api.gitPush()
      return { output: `${result.output} · ${pushed.output}` }
    })
  },
  /** 放弃更改：已跟踪的还原，未跟踪的删除 */
  discard(paths: string[], untracked: string[] = []) {
    return git.run('放弃更改', () => api.gitDiscard(paths, untracked))
  },
  push() {
    return git.run('推送', () => api.gitPush())
  }
}
