/**
 * 源代码管理面板（VS Code 风格）：
 *
 *   ⎇ main  ↑1 ↓0                     [⤴ 推送] [↻]
 *   ┌──────────────────────────────────────────────┐
 *   │ 提交信息（Ctrl+Enter 提交）                    │
 *   └──────────────────────────────────────────────┘
 *   [ ✓ 提交 ]
 *   ▾ 已暂存的更改 (1)                        [− 全部]
 *      M  Bidding.py        Bidding           [−]
 *   ▾ 更改 (9999)                            [+ 全部]
 *      U  ahp.html          AHP               [+]
 *
 * 点一条变更看 HEAD ⇄ 工作区的 diff；行尾 ＋/− 暂存或取消暂存。
 * 所有写操作都在宿主侧用固定参数的 git 命令完成（不经 shell）。
 */

import * as React from 'react'

import { h } from '../../h'
import { git, type GitChange } from './git'

function dirOf(path: string): string {
  const at = path.lastIndexOf('/')
  return at === -1 ? '' : path.slice(0, at)
}

function baseOf(path: string): string {
  return path.split('/').pop() ?? path
}

/** git 状态字母 → 中文提示 */
function codeHint(code: string): string {
  if (code === 'M') return '已修改'
  if (code === 'A') return '已新增'
  if (code === 'D') return '已删除'
  if (code === 'R') return '已重命名'
  if (code === 'C') return '已复制'
  if (code === '?') return '未跟踪'
  if (code === 'U') return '已更新'
  return code
}

function Row({ change, busy, staged }: { change: GitChange; busy: boolean; staged: boolean }) {
  return h(
    'div',
    { className: 'dsv-scm-row', title: `${change.path}\n${codeHint(change.code)}`, onClick: () => void git.openChange(change) },
    h('span', { className: 'dsv-scm-status', 'data-code': change.code }, change.code),
    h('span', { className: 'dsv-scm-name' }, baseOf(change.path)),
    h('span', { className: 'dsv-scm-dir' }, dirOf(change.path)),
    h('span', { className: 'dsv-scm-spacer' }),
    h(
      'button',
      {
        className: 'dsv-scm-row-action',
        title: staged ? '取消暂存' : '暂存更改',
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

function Section({
  title,
  count,
  collapsed,
  onToggle,
  actionTitle,
  actionLabel,
  onAction,
  disabled
}: {
  title: string
  count: number
  collapsed: boolean
  onToggle: () => void
  actionTitle: string
  actionLabel: string
  onAction: () => void
  disabled: boolean
}) {
  return h(
    'div',
    { className: 'dsv-scm-section-head' },
    h('button', { className: 'dsv-scm-section-toggle', onClick: onToggle, title: collapsed ? '展开' : '折叠' }, collapsed ? '▸' : '▾'),
    h('span', { className: 'dsv-scm-section-title', onClick: onToggle }, title),
    h('span', { className: 'dsv-scm-count' }, String(count)),
    h('span', { className: 'dsv-scm-spacer' }),
    h(
      'button',
      { className: 'dsv-scm-section-action', title: actionTitle, disabled, onClick: onAction },
      actionLabel
    )
  )
}

export function SourceControl({ cwd, remote }: { cwd: string | null; remote?: boolean }) {
  const snap = React.useSyncExternalStore(git.subscribe, git.getSnapshot)
  const [message, setMessage] = React.useState('')
  const [collapsed, setCollapsed] = React.useState({ staged: false, unstaged: false })

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

  const toggle = (key: 'staged' | 'unstaged') =>
    setCollapsed((previous) => ({ ...previous, [key]: !previous[key] }))

  return h(
    'div',
    { className: 'dsv-panel' },

    /* 分支条：VS Code 的「Graph / branch」那一行 */
    h(
      'div',
      { className: 'dsv-scm-branch' },
      h('span', { className: 'dsv-scm-branch-name', title: snap.branch || '未知分支' }, snap.branch ? `⎇ ${snap.branch}` : '源代码管理'),
      snap.ahead || snap.behind
        ? h('span', { className: 'dsv-scm-sync', title: '本地领先 / 落后远端' }, `↑${snap.ahead} ↓${snap.behind}`)
        : null,
      h('span', { className: 'dsv-scm-spacer' }),
      h(
        'button',
        {
          className: 'dsv-scm-icon-btn',
          title: snap.ahead > 0 ? `推送 ${snap.ahead} 个提交` : '推送到远端',
          disabled: snap.busy,
          onClick: () => void git.push()
        },
        '⤴'
      ),
      h('button', { className: 'dsv-scm-icon-btn', title: '刷新 Git 状态', onClick: () => void git.refresh() }, '↻')
    ),

    remote
      ? h(
          'div',
          { className: 'dsv-tree-note' },
          '当前是远程工作区：资源管理器已走 SFTP，但源代码管理还没有适配远端仓库（Git 面板只对本地工作区有效）。'
        )
      : null,
    remote ? null : snap.phase === 'error' ? h('div', { className: 'dsv-tree-note' }, snap.message) : null,

    /* 提交区 */
    h(
      'div',
      { className: 'dsv-scm-commit' },
      h('textarea', {
        className: 'dsv-scm-message',
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
        'button',
        {
          className: 'dsv-scm-commit-btn',
          disabled: !canCommit,
          title: staged.length === 0 ? '先暂存要提交的文件' : message.trim() ? '提交已暂存的更改（Ctrl+Enter）' : '先写提交信息',
          onClick: () => void submit()
        },
        snap.busy ? '处理中…' : `✓ 提交${staged.length > 0 ? ` (${staged.length})` : ''}`
      ),
      snap.note ? h('div', { className: 'dsv-scm-note', title: snap.note }, snap.note) : null
    ),

    /* 变更列表 */
    h(
      'div',
      { className: 'dsv-tree dsv-scm-list' },
      snap.phase === 'ready' && snap.changes.length === 0
        ? h('div', { className: 'dsv-scm-empty' }, h('span', { className: 'dsv-scm-empty-icon' }, '✓'), '没有未提交的变更')
        : null,

      staged.length > 0
        ? h(
            React.Fragment,
            null,
            h(Section, {
              title: '已暂存的更改',
              count: staged.length,
              collapsed: collapsed.staged,
              onToggle: () => toggle('staged'),
              actionTitle: '全部取消暂存',
              actionLabel: '−',
              onAction: () => void git.unstageAll(),
              disabled: snap.busy
            }),
            staged.length > 500 ? h('div', { className: 'dsv-tree-note' }, `仅显示前 500 条（共 ${staged.length} 条）`) : null,
            collapsed.staged
              ? null
              : staged.slice(0, 500).map((change) => h(Row, { key: `s:${change.path}`, change, busy: snap.busy, staged: true }))
          )
        : null,

      unstaged.length > 0
        ? h(
            React.Fragment,
            null,
            h(Section, {
              title: '更改',
              count: unstaged.length,
              collapsed: collapsed.unstaged,
              onToggle: () => toggle('unstaged'),
              actionTitle: '全部暂存',
              actionLabel: '＋',
              onAction: () => void git.stageAll(),
              disabled: snap.busy
            }),
            unstaged.length > 500 ? h('div', { className: 'dsv-tree-note' }, `仅显示前 500 条（共 ${unstaged.length} 条）`) : null,
            collapsed.unstaged
              ? null
              : unstaged.slice(0, 500).map((change) => h(Row, { key: `u:${change.path}`, change, busy: snap.busy, staged: false }))
          )
        : null
    )
  )
}
