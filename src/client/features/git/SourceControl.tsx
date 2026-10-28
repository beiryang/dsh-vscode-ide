/**
 * 源代码管理面板：分支 / 变更列表 / 暂存 / 提交 / 推送。
 *
 * 点一条变更看 HEAD ⇄ 工作区的 diff；行尾 ＋/− 直接暂存或取消暂存。
 * 所有写操作都在宿主侧用固定参数的 git 命令完成（不经 shell）。
 */

import * as React from 'react'

import { h } from '../../h'
import { git, type GitChange } from './git'

function dirOf(path: string): string {
  const at = path.lastIndexOf('/')
  return at === -1 ? '' : path.slice(0, at)
}

function Row({ change, busy, staged }: { change: GitChange; busy: boolean; staged: boolean }) {
  return h(
    'div',
    { className: 'dsv-tree-row', title: change.path, onClick: () => void git.openChange(change) },
    h('span', { className: 'dsv-git-code', 'data-code': change.code }, change.code),
    h('span', { className: 'dsv-tree-name' }, change.path.split('/').pop()),
    h('span', { className: 'dsv-git-dir' }, dirOf(change.path)),
    h(
      'button',
      {
        className: 'dsv-git-row-btn',
        title: staged ? '取消暂存' : '暂存',
        disabled: busy,
        onClick: (event: React.MouseEvent) => {
          event.stopPropagation()
          if (staged) void git.unstage([change.absPath])
          else void git.stage([change.absPath])
        }
      },
      staged ? '−' : '＋'
    )
  )
}

export function SourceControl({ cwd, remote }: { cwd: string | null; remote?: boolean }) {
  const snap = React.useSyncExternalStore(git.subscribe, git.getSnapshot)
  const [message, setMessage] = React.useState('')

  React.useEffect(() => {
    if (cwd && !remote) void git.refresh()
  }, [cwd, remote])

  const staged = snap.changes.filter((change) => change.staged)
  const unstaged = snap.changes.filter((change) => !change.staged)
  const canCommit = staged.length > 0 && message.trim().length > 0 && !snap.busy

  const submit = async () => {
    if (!canCommit) return
    await git.commit(message.trim())
    setMessage('')
  }

  return h(
    'div',
    { className: 'dsv-panel' },
    h(
      'div',
      { className: 'dsv-panel-head' },
      h('span', null, snap.branch ? `⎇ ${snap.branch}` : '源代码管理'),
      snap.ahead || snap.behind ? h('span', { className: 'dsv-git-counts' }, `↑${snap.ahead} ↓${snap.behind}`) : null,
      h('span', { style: { flex: 1 } }),
      h('span', { className: 'dsv-git-version' }, `v${(window as unknown as { __dsv?: { version?: string } }).__dsv?.version ?? '?'}`),
      h('button', { className: 'dsv-mini-btn', title: '刷新 Git 状态', onClick: () => void git.refresh() }, '↻')
    ),

    remote
      ? h(
          'div',
          { className: 'dsv-tree-note' },
          '当前是远程工作区：资源管理器已走 SFTP，但源代码管理还没有适配远端仓库（Git 面板只对本地工作区有效）。'
        )
      : null,

    remote ? null : snap.phase === 'error' ? h('div', { className: 'dsv-tree-note' }, snap.message) : null,

    h(
      'div',
      { className: 'dsv-git-commit' },
      h('textarea', {
        className: 'dsv-git-message',
        rows: 2,
        placeholder: '提交信息（Ctrl+Enter 提交）',
        value: message,
        disabled: snap.busy,
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(event.target.value),
        onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            void submit()
          }
        }
      }),
      h(
        'div',
        { className: 'dsv-git-actions' },
        h(
          'button',
          {
            className: 'dsv-git-btn dsv-git-btn-primary',
            disabled: !canCommit,
            title: staged.length === 0 ? '先暂存要提交的文件' : message.trim() ? '提交已暂存的更改' : '先写提交信息',
            onClick: () => void submit()
          },
          snap.busy ? '处理中…' : `提交${staged.length > 0 ? ` (${staged.length})` : ''}`
        ),
        h(
          'button',
          { className: 'dsv-git-btn', disabled: snap.busy || snap.changes.length === 0, onClick: () => void git.stageAll() },
          '全部暂存'
        ),
        h(
          'button',
          { className: 'dsv-git-btn', disabled: snap.busy || staged.length === 0, onClick: () => void git.unstageAll() },
          '取消全部'
        ),
        h(
          'button',
          { className: 'dsv-git-btn', disabled: snap.busy || snap.ahead === 0, onClick: () => void git.push() },
          snap.ahead > 0 ? `推送 ↑${snap.ahead}` : '推送'
        )
      ),
      snap.note ? h('div', { className: 'dsv-git-note', title: snap.note }, snap.note) : null
    ),

    h(
      'div',
      { className: 'dsv-tree' },
      snap.phase === 'ready' && snap.changes.length === 0 ? h('div', { className: 'dsv-tree-note' }, '没有未提交的变更') : null,

      staged.length > 0 ? h('div', { className: 'dsv-git-group' }, `暂存的更改 (${staged.length})`) : null,
      staged.length > 500 ? h('div', { className: 'dsv-tree-note' }, `仅显示前 500 条（共 ${staged.length} 条）`) : null,
      staged.slice(0, 500).map((change) => h(Row, { key: `s:${change.path}`, change, busy: snap.busy, staged: true })),

      unstaged.length > 0 ? h('div', { className: 'dsv-git-group' }, `更改 (${unstaged.length})`) : null,
      unstaged.length > 500 ? h('div', { className: 'dsv-tree-note' }, `仅显示前 500 条（共 ${unstaged.length} 条）`) : null,
      unstaged.slice(0, 500).map((change) => h(Row, { key: `u:${change.path}`, change, busy: snap.busy, staged: false }))
    )
  )
}
