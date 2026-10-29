/**
 * 源代码管理面板（VS Code 风格）：
 *
 *   ⎇ main  ↑1 ↓0                     [⤴ 推送] [↻]
 *   ┌──────────────────────────────────────────────┐
 *   │ 提交信息（Ctrl+Enter 提交）                    │
 *   └──────────────────────────────────────────────┘
 *   [     ✓ 提交 (1)     ][▾]
 *   ▾ 已暂存的更改 (1)                        [ − ]
 *      M  Bidding.py        Bidding           [ −]
 *   ▾ 更改 (9999)                            [ ＋ ]
 *      U  ahp.html          AHP               [ ＋ ]
 *
 * 右键单行：打开对比 / 暂存 / 放弃更改 / 复制路径。
 * 提交按钮右侧 ▾：提交 / 提交全部 / 提交并推送。
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

function codeHint(code: string): string {
  if (code === 'M') return '已修改'
  if (code === 'A') return '已新增'
  if (code === 'D') return '已删除'
  if (code === 'R') return '已重命名'
  if (code === 'C') return '已复制'
  if (code === 'U') return '未跟踪'
  return code
}

type MenuState = { x: number; y: number; change: GitChange; staged: boolean }

function Row({
  change,
  busy,
  staged,
  onMenu
}: {
  change: GitChange
  busy: boolean
  staged: boolean
  onMenu: (event: React.MouseEvent, change: GitChange, staged: boolean) => void
}) {
  return h(
    'div',
    {
      className: 'dsv-scm-row',
      title: `${change.path}\n${codeHint(change.code)}（右键更多操作）`,
      onClick: () => void git.openChange(change),
      onContextMenu: (event: React.MouseEvent) => onMenu(event, change, staged)
    },
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
    h('button', { className: 'dsv-scm-section-action', title: actionTitle, disabled, onClick: onAction }, actionLabel)
  )
}

export function SourceControl({ cwd, remote }: { cwd: string | null; remote?: boolean }) {
  const snap = React.useSyncExternalStore(git.subscribe, git.getSnapshot)
  const [message, setMessage] = React.useState('')
  const [collapsed, setCollapsed] = React.useState({ staged: false, unstaged: false })
  const [menu, setMenu] = React.useState<MenuState | null>(null)
  const [commitMenu, setCommitMenu] = React.useState(false)

  React.useEffect(() => {
    if (cwd) void git.refresh()
  }, [cwd, remote])

  // 点别处关掉右键菜单 / 提交下拉
  React.useEffect(() => {
    if (!menu && !commitMenu) return
    const close = () => {
      setMenu(null)
      setCommitMenu(false)
    }
    const timer = window.setTimeout(() => {
      window.addEventListener('pointerdown', close)
      window.addEventListener('blur', close)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('blur', close)
    }
  }, [menu, commitMenu])

  const staged = snap.changes.filter((change) => change.staged)
  const unstaged = snap.changes.filter((change) => !change.staged)
  const canCommit = staged.length > 0 && message.trim().length > 0 && !snap.busy
  const hasMessage = message.trim().length > 0 && !snap.busy

  const submit = async () => {
    if (!canCommit) return
    await git.commit(message.trim())
    setMessage('')
  }

  const submitAll = async () => {
    if (!hasMessage) return
    await git.commitAll(message.trim())
    setMessage('')
  }

  const submitAndPush = async () => {
    if (!hasMessage) return
    await git.commitAndPush(message.trim())
    setMessage('')
  }

  const toggle = (key: 'staged' | 'unstaged') => setCollapsed((previous) => ({ ...previous, [key]: !previous[key] }))

  const openMenu = (event: React.MouseEvent, change: GitChange, stagedRow: boolean) => {
    event.preventDefault()
    event.stopPropagation()
    setCommitMenu(false)
    setMenu({ x: event.clientX, y: event.clientY, change, staged: stagedRow })
  }

  const discard = (change: GitChange) => {
    const untracked = change.code === 'U'
    const what = untracked ? '删除未跟踪文件' : '放弃这条更改（还原到上次提交的版本）'
    if (!window.confirm(`确定要${what}？\n\n${change.path}\n\n此操作不可撤销。`)) return
    void git.discard(untracked ? [] : [change.absPath], untracked ? [change.path] : [])
  }

  const copyPath = (change: GitChange) => {
    void navigator.clipboard?.writeText(change.path).catch(() => undefined)
  }

  return h(
    'div',
    { className: 'dsv-panel' },

    /* 分支条 */
    h(
      'div',
      { className: 'dsv-scm-branch' },
      h('span', { className: 'dsv-scm-branch-name', title: snap.branch || '未知分支' }, snap.branch ? `⎇ ${snap.branch}` : '源代码管理'),
      snap.ahead || snap.behind ? h('span', { className: 'dsv-scm-sync', title: '本地领先 / 落后远端' }, `↑${snap.ahead} ↓${snap.behind}`) : null,
      remote ? h('span', { className: 'dsv-scm-sync', title: '命令在服务器上执行' }, '远程') : null,
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

    snap.phase === 'error'
      ? h(
          'div',
          { className: 'dsv-scm-empty' },
          h('span', { className: 'dsv-scm-empty-icon' }, '⎇'),
          h('div', null, remote ? '当前远程目录不是 Git 仓库' : '当前目录不是 Git 仓库'),
          h(
            'div',
            { className: 'dsv-scm-hint' },
            remote
              ? 'Git 命令会在服务器上执行。请把工作区指到仓库根目录，或在服务器上执行 git init。'
              : '把工作区切到仓库根目录，或在这个目录里执行 git init。'
          ),
          snap.message && !/不是 Git 仓库/.test(snap.message) ? h('div', { className: 'dsv-scm-hint' }, snap.message) : null
        )
      : null,

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
        'div',
        { className: 'dsv-scm-commit-row' },
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
        h(
          'button',
          {
            className: 'dsv-scm-commit-caret',
            title: '更多提交方式',
            disabled: snap.busy,
            onClick: (event: React.MouseEvent) => {
              event.stopPropagation()
              setMenu(null)
              setCommitMenu((previous) => !previous)
            }
          },
          '▾'
        )
      ),
      commitMenu
        ? h(
            'div',
            { className: 'dsv-scm-dropdown', onPointerDown: (event: React.PointerEvent) => event.stopPropagation() },
            h('button', { disabled: !canCommit, onClick: () => { setCommitMenu(false); void submit() } }, '提交已暂存的更改'),
            h('button', { disabled: !hasMessage, onClick: () => { setCommitMenu(false); void submitAll() } }, '提交全部更改（先全部暂存）'),
            h('button', { disabled: !hasMessage, onClick: () => { setCommitMenu(false); void submitAndPush() } }, '提交并推送')
          )
        : null,
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
              : staged
                  .slice(0, 500)
                  .map((change) => h(Row, { key: `s:${change.path}`, change, busy: snap.busy, staged: true, onMenu: openMenu }))
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
              : unstaged
                  .slice(0, 500)
                  .map((change) => h(Row, { key: `u:${change.path}`, change, busy: snap.busy, staged: false, onMenu: openMenu }))
          )
        : null
    ),

    /* 右键菜单 */
    menu
      ? h(
          'div',
          {
            className: 'dsv-scm-menu',
            style: { left: `${menu.x}px`, top: `${menu.y}px` },
            onPointerDown: (event: React.PointerEvent) => event.stopPropagation()
          },
          h('button', { onClick: () => { setMenu(null); void git.openChange(menu.change) } }, '打开对比'),
          h(
            'button',
            {
              onClick: () => {
                setMenu(null)
                if (menu.staged) void git.unstage([menu.change.absPath])
                else void git.stage([menu.change.absPath])
              }
            },
            menu.staged ? '取消暂存' : '暂存更改'
          ),
          h('button', { onClick: () => { setMenu(null); discard(menu.change) } }, '放弃更改…'),
          h('button', { onClick: () => { setMenu(null); copyPath(menu.change) } }, '复制相对路径')
        )
      : null
  )
}
