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
import { FileIcon } from '../explorer/FileIcon'
import { registry } from '../../kernel/registry'
import { api } from '../../kernel/transport'
import { git, type GitChange } from './git'
import { gitRootDialog } from './rootDialog'

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

type Commit = {
  hash: string
  full?: string
  author: string
  when: string
  subject: string
  parents?: string[]
  refs: string
}

function refBadges(refs: string): Array<{ label: string; kind: 'branch' | 'remote' | 'tag' | 'ref' }> {
  return refs
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((raw) => {
      if (raw.startsWith('HEAD -> ')) return { label: raw.slice('HEAD -> '.length), kind: 'branch' as const }
      if (raw.startsWith('tag: ')) return { label: raw.slice(5), kind: 'tag' as const }
      if (/^[^/]+\//.test(raw)) return { label: raw, kind: 'remote' as const }
      return { label: raw, kind: 'ref' as const }
    })
}

type CommitDetail = {
  files: Array<{ status: string; path: string }>
  error?: string
}

function LaneTrack({ lanes, dot }: { lanes: LaneRow; dot: boolean }) {
  const width = lanes.count * 10 + 2
  return h(
    'div',
    { className: 'dsv-scm-lane-track', style: { width: `${width}px` } },
    lanes.occupied.map((active, index) =>
      active
        ? h('span', {
            key: `lane-${index}`,
            className: 'dsv-scm-lane',
            style: { left: `${index * 10 + 5}px`, background: LANE_COLORS[index % LANE_COLORS.length] }
          })
        : null
    ),
    lanes.links.length > 0
      ? h(
          'svg',
          {
            key: 'links',
            className: 'dsv-scm-lane-curves',
            width,
            height: '100%',
            viewBox: `0 0 ${width} 26`,
            preserveAspectRatio: 'none',
            'shape-rendering': 'geometricPrecision'
          },
          lanes.links.map((link, index) =>
            h('path', {
              key: `link-${index}`,
              d: `M ${link.from * 10 + 6} 13 Q ${link.from * 10 + 6} 26 ${link.to * 10 + 6} 26`,
              fill: 'none',
              stroke: LANE_COLORS[link.to % LANE_COLORS.length],
              'stroke-width': 2,
              'stroke-opacity': 0.75
            })
          )
        )
      : null,
    dot
      ? h('span', {
          key: 'dot',
          className: 'dsv-scm-dot',
          style: { left: `${lanes.dot * 10 + 2}px`, background: LANE_COLORS[lanes.dot % LANE_COLORS.length] }
        })
      : null
  )
}

const LANE_COLORS = ['#61afef', '#98c379', '#e5c07b', '#c678dd', '#56b6c2', '#e06c75']

type LaneRow = { dot: number; count: number; occupied: boolean[]; links: Array<{ from: number; to: number }> }

/** 简单的多车道布局：每个活跃分支一条竖线，提交落在自己的车道上 */
function buildLanes(commits: Commit[]): LaneRow[] {
  const lanes: Array<string | null> = []
  const rows: LaneRow[] = []
  for (const commit of commits) {
    // 关键：parents 是完整 hash（%P），提交列表里是短 hash（%h），
    // 必须用完整 hash 做车道匹配，否则线性历史会被误判成一条条新分支
    const key = commit.full ?? commit.hash
    const links: Array<{ from: number; to: number }> = []
    let lane = lanes.indexOf(key)
    if (lane < 0) {
      lane = lanes.findIndex((value) => value === null)
      if (lane < 0) {
        lane = lanes.length
        lanes.push(null)
      }
    }
    lanes[lane] = key
    const parents = (commit.parents ?? []).filter(Boolean)
    lanes[lane] = parents[0] ?? null
    for (const parent of parents.slice(1)) {
      if (lanes.includes(parent)) continue
      let slot = lanes.findIndex((value, index) => value === null && index !== lane)
      if (slot < 0) {
        slot = lanes.length
        lanes.push(null)
      }
      lanes[slot] = parent
      links.push({ from: lane, to: slot })
    }
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop()
    rows.push({ dot: lane, count: Math.max(1, lanes.length), occupied: lanes.map((value) => value !== null), links })
  }
  return rows
}

function GraphRow({
  commit,
  lanes,
  expanded,
  detail,
  busy,
  onToggle,
  onOpenFile,
  onHover,
  onLeave,
  onMenu
}: {
  commit: Commit
  lanes: LaneRow
  expanded: boolean
  detail?: CommitDetail
  busy: boolean
  onToggle: () => void
  onOpenFile: (path: string) => void
  onHover: (event: React.MouseEvent, commit: Commit) => void
  onLeave: () => void
  onMenu: (event: React.MouseEvent, commit: Commit) => void
}) {
  return h(
    'div',
    { className: 'dsv-scm-commit-item' },
    h(
      'div',
      {
        className: 'dsv-scm-graph-row',
        'data-active': expanded ? 'true' : 'false',
        onClick: onToggle,
        onMouseEnter: (event: React.MouseEvent) => onHover(event, commit),
        onContextMenu: (event: React.MouseEvent) => onMenu(event, commit),
        onMouseLeave: onLeave,
        title: '点击查看这次提交改了哪些文件'
      },
      h(LaneTrack, { lanes, dot: true }),
      h('span', { className: 'dsv-scm-graph-subject' }, commit.subject),
      h('span', { className: 'dsv-scm-graph-author' }, commit.author),
      refBadges(commit.refs).map((badge) =>
        h('span', { key: badge.label, className: 'dsv-scm-ref', 'data-kind': badge.kind }, badge.label)
      ),
      h('span', { className: 'dsv-scm-commit-toggle' }, expanded ? '▾' : '▸')
    ),
    expanded
      ? h(
          'div',
          { className: 'dsv-scm-commit-files' },
          h(LaneTrack, { lanes, dot: false }),
          busy
            ? h('div', { className: 'dsv-scm-hint' }, '读取提交内容…')
            : detail?.error
              ? h('div', { className: 'dsv-scm-hint' }, detail.error)
              : (detail?.files ?? []).length === 0
                ? h('div', { className: 'dsv-scm-hint' }, '这次提交没有文件变更（或尚未加载）')
                : detail!.files.map((file) =>
                    h(
                      'div',
                      {
                        key: file.path,
                        className: 'dsv-scm-commit-file',
                        onClick: (event: React.MouseEvent) => {
                          event.stopPropagation()
                          onOpenFile(file.path)
                        },
                        title: `${file.path}（点击查看这次提交的改动）`
                      },
                      h(FileIcon, { name: baseOf(file.path), dir: false, expanded: false }),
                      h('span', { className: 'dsv-scm-name' }, baseOf(file.path)),
                      h('span', { className: 'dsv-scm-dir' }, dirOf(file.path)),
                      h('span', { className: 'dsv-scm-spacer' }),
                      h('span', { className: 'dsv-scm-status', 'data-code': file.status }, file.status)
                    )
                  )
        )
      : null
  )
}

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
    h(FileIcon, { name: baseOf(change.path), dir: false, expanded: false }),
    h('span', { className: 'dsv-scm-name' }, baseOf(change.path)),
    h('span', { className: 'dsv-scm-dir' }, dirOf(change.path)),
    h('span', { className: 'dsv-scm-spacer' }),
    h('span', { className: 'dsv-scm-status', 'data-code': change.code }, change.code),
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
  const [commitDropdown, setCommitDropdown] = React.useState(false)
  const [rootMenu, setRootMenu] = React.useState(false)
  const [graphCollapsed, setGraphCollapsed] = React.useState(false)
  const [tip, setTip] = React.useState<{ commit: Commit; x: number; y: number } | null>(null)
  const [commitMenu, setCommitMenu] = React.useState<{ x: number; y: number; commit: Commit } | null>(null)
  const [branchFor, setBranchFor] = React.useState<Commit | null>(null)
  const [branchName, setBranchName] = React.useState('')
  const [openCommit, setOpenCommit] = React.useState<string | null>(null)
  const [commitDetails, setCommitDetails] = React.useState<Record<string, CommitDetail>>({})
  const [commitBusy, setCommitBusy] = React.useState<string | null>(null)
  const [graphHeight, setGraphHeight] = React.useState(() => {
    try {
      const raw = localStorage.getItem('dsv:git.graph.v1')
      const value = raw ? Number(JSON.parse(raw).height) : NaN
      if (Number.isFinite(value) && value >= 80) return Math.min(value, 640)
    } catch {
      /* ignore */
    }
    return 220
  })

  React.useEffect(() => {
    git.attach(cwd)
  }, [cwd, remote])

  // 点别处关掉右键菜单 / 提交下拉
  React.useEffect(() => {
    if (!menu && !commitDropdown && !rootMenu) return
    const close = () => {
      setMenu(null)
      setCommitDropdown(false)
      setRootMenu(false)
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
  }, [menu, commitDropdown, rootMenu])

  const lanes = React.useMemo(() => buildLanes(snap.commits), [snap.commits])
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

  /** 拖动 Graph 顶部的手柄调整高度（向上拖变大） */
  const toggleCommit = async (hash: string) => {
    if (openCommit === hash) {
      setOpenCommit(null)
      return
    }
    setOpenCommit(hash)
    if (commitDetails[hash]) return
    setCommitBusy(hash)
    try {
      const info = await api.gitCommitInfo(hash, snap.gitRoot)
      setCommitDetails((previous) => ({ ...previous, [hash]: { files: info.files ?? [] } }))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setCommitDetails((previous) => ({ ...previous, [hash]: { files: [], error: message } }))
    } finally {
      setCommitBusy(null)
    }
  }

  const fullRef = (commit: Commit) => commit.full ?? commit.hash

  const runCommitAction = async (label: string, action: () => Promise<unknown>) => {
    await git.run(label, action)
    await git.refresh()
  }

  const openCommitFile = async (hash: string, filePath: string) => {
    try {
      const result = await api.gitCommitFile(hash, filePath, snap.gitRoot)
      const name = baseOf(filePath)
      registry.openDiff(
        { path: filePath, name: `${name} · ${hash}^`, text: result.left },
        { path: filePath, name: `${name} · ${hash}`, text: result.right }
      )
    } catch (cause) {
      publishCommitError(cause)
    }
  }

  const publishCommitError = (cause: unknown) => {
    const message = cause instanceof Error ? cause.message : String(cause)
    window.alert(`打开提交对比失败：${message}`)
  }

  const beginGraphResize = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    // 注意：React 合成事件的 currentTarget 在回调结束后会变成 null，
    // 必须在这里先抓住 DOM 节点，不能在 onMove 里再读
    const handle = event.currentTarget as HTMLElement
    const startY = event.clientY
    const startHeight = graphHeight
    const onMove = (moveEvent: PointerEvent) => {
      const panel = handle.closest('.dsv-panel') as HTMLElement | null
      const maxHeight = Math.max(120, (panel?.clientHeight ?? window.innerHeight) * 0.7)
      const next = Math.min(Math.max(startHeight + (startY - moveEvent.clientY), 80), maxHeight)
      setGraphHeight(next)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setGraphHeight((current) => {
        try {
          localStorage.setItem('dsv:git.graph.v1', JSON.stringify({ height: current }))
        } catch {
          /* ignore */
        }
        return current
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const openMenu = (event: React.MouseEvent, change: GitChange, stagedRow: boolean) => {
    event.preventDefault()
    event.stopPropagation()
    setCommitDropdown(false)
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
      snap.gitRoot ? h('span', { className: 'dsv-scm-root', title: `Git 目录：${snap.gitRoot}` }, ` · ${snap.gitRoot}`) : null,
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
      h('button', { className: 'dsv-scm-icon-btn', title: '刷新 Git 状态', onClick: () => void git.refresh() }, '↻'),
      h(
        'button',
        {
          className: 'dsv-scm-icon-btn',
          title: '仓库设置（更改 / 清除 Git 仓库目录）',
          onClick: (event: React.MouseEvent) => {
            event.stopPropagation()
            setRootMenu((previous) => !previous)
          }
        },
        '⋯'
      ),
      rootMenu
        ? h(
            'div',
            { className: 'dsv-scm-dropdown dsv-scm-more', onPointerDown: (event: React.PointerEvent) => event.stopPropagation() },
            h(
              'button',
              { onClick: () => { setRootMenu(false); gitRootDialog.open() } },
              snap.gitRoot ? '更改 Git 仓库目录…' : '选择 Git 仓库目录…'
            ),
            h(
              'button',
              {
                disabled: !snap.gitRoot,
                onClick: () => {
                  setRootMenu(false)
                  git.setRoot('')
                }
              },
              '清除选择（用工作区根）'
            )
          )
        : null
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
              ? 'Git 命令会在服务器上执行。可以指定一个子目录作为仓库，或把工作区指到仓库根目录。'
              : '可以指定一个子目录作为仓库，或把工作区切到仓库根目录。'
          ),
          h('button', { className: 'dsv-scm-root-btn', onClick: () => gitRootDialog.open() }, '选择仓库目录…'),
          snap.message && !/不是 Git 仓库/.test(snap.message) ? h('div', { className: 'dsv-scm-hint' }, snap.message) : null
        )
      : null,

    /* 提交区 */
    h(
      'div',
      { className: 'dsv-scm-commit-item' },
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
              setRootMenu(false)
              setCommitDropdown((previous) => !previous)
            }
          },
          '▾'
        )
      ),
      commitMenu
        ? h(
            'div',
            { className: 'dsv-scm-dropdown', onPointerDown: (event: React.PointerEvent) => event.stopPropagation() },
            h('button', { disabled: !canCommit, onClick: () => { setCommitDropdown(false); void submit() } }, '提交已暂存的更改'),
            h('button', { disabled: !hasMessage, onClick: () => { setCommitDropdown(false); void submitAll() } }, '提交全部更改（先全部暂存）'),
            h('button', { disabled: !hasMessage, onClick: () => { setCommitDropdown(false); void submitAndPush() } }, '提交并推送')
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

    /* Graph：最近提交 + 远端操作（顶部可拖动调高度） */
    graphCollapsed
      ? null
      : h('div', {
          className: 'dsv-scm-graph-resize',
          onPointerDown: beginGraphResize,
          onDoubleClick: () => setGraphHeight(220),
          title: '拖动调整 Graph 高度（双击恢复默认）'
        }),
    h(
      'div',
      { className: 'dsv-scm-section-head' },
      h(
        'button',
        { className: 'dsv-scm-section-toggle', onClick: () => setGraphCollapsed((previous) => !previous), title: graphCollapsed ? '展开' : '折叠' },
        graphCollapsed ? '▸' : '▾'
      ),
      h('span', { className: 'dsv-scm-section-title', onClick: () => setGraphCollapsed((previous) => !previous) }, 'Graph'),
      h('span', { className: 'dsv-scm-count' }, String(snap.commits.length)),
      h('span', { className: 'dsv-scm-spacer' }),
      h('button', { className: 'dsv-scm-icon-btn', title: '刷新', onClick: () => void git.refresh() }, '↻'),
      h('button', { className: 'dsv-scm-icon-btn', title: '获取远端（fetch）', disabled: snap.busy, onClick: () => void git.fetch() }, '⤓'),
      h('button', { className: 'dsv-scm-icon-btn', title: '拉取（pull）', disabled: snap.busy, onClick: () => void git.pull() }, '↓'),
      h('button', { className: 'dsv-scm-icon-btn', title: '推送（push）', disabled: snap.busy, onClick: () => void git.push() }, '↑')
    ),
    graphCollapsed
      ? null
      : h(
          'div',
          { className: 'dsv-scm-graph', style: { height: `${graphHeight}px` } },
          snap.commits.map((commit, index) =>
            h(GraphRow, {
              key: commit.hash,
              commit,
              lanes: lanes[index] ?? { dot: 0, count: 1, occupied: [true], links: [] },
              expanded: openCommit === commit.hash,
              detail: commitDetails[commit.hash],
              busy: commitBusy === commit.hash,
              onToggle: () => void toggleCommit(commit.hash),
              onOpenFile: (filePath: string) => void openCommitFile(commit.hash, filePath),
              onHover: (event: React.MouseEvent, hovered: Commit) => {
                const width = 320
                const x = Math.min(event.clientX + 14, window.innerWidth - width - 12)
                setTip({ commit: hovered, x: Math.max(8, x), y: Math.min(event.clientY + 12, window.innerHeight - 160) })
              },
              onLeave: () => setTip(null),
              onMenu: (event: React.MouseEvent, hovered: Commit) => {
                event.preventDefault()
                setCommitMenu({ x: event.clientX, y: event.clientY, commit: hovered })
              }
            })
          )
        ),

    /* 提交悬停信息卡 */
    tip
      ? h(
          'div',
          { className: 'dsv-scm-tip', style: { left: `${tip.x}px`, top: `${tip.y}px` } },
          h(
            'div',
            { className: 'dsv-scm-tip-head' },
            h('span', { className: 'dsv-scm-tip-author' }, `👤 ${tip.commit.author}`),
            h('span', { className: 'dsv-scm-tip-when' }, `· ${tip.commit.when}`)
          ),
          h('div', { className: 'dsv-scm-tip-subject' }, tip.commit.subject),
          h(
            'div',
            { className: 'dsv-scm-tip-meta' },
            h('span', { className: 'dsv-scm-tip-hash' }, tip.commit.hash),
            refBadges(tip.commit.refs).map((badge) =>
              h('span', { key: `tip:${badge.label}`, className: 'dsv-scm-ref', 'data-kind': badge.kind }, badge.label)
            )
          )
        )
      : null,

    /* 提交右键菜单 */
    commitMenu
      ? h(
          'div',
          {
            className: 'dsv-scm-commit-menu',
            style: { left: `${commitMenu.x}px`, top: `${commitMenu.y}px` },
            onPointerDown: (event: React.PointerEvent) => event.stopPropagation()
          },
          h(
            'button',
            {
              className: 'dsv-scm-commit-menu-item',
              onClick: () => {
                void navigator.clipboard?.writeText(commitMenu.commit.hash).catch(() => undefined)
                setCommitMenu(null)
              }
            },
            `复制短 hash（${commitMenu.commit.hash}）`
          ),
          h(
            'button',
            {
              className: 'dsv-scm-commit-menu-item',
              onClick: () => {
                void navigator.clipboard?.writeText(fullRef(commitMenu.commit)).catch(() => undefined)
                setCommitMenu(null)
              }
            },
            '复制完整 hash'
          ),
          h(
            'button',
            {
              className: 'dsv-scm-commit-menu-item',
              onClick: () => {
                const commit = commitMenu.commit
                setCommitMenu(null)
                if (!window.confirm(`检出提交 ${commit.hash}？工作区会切换到该提交（detached HEAD）。`)) return
                void runCommitAction('检出提交', () => api.gitCheckout(fullRef(commit), snap.gitRoot))
              }
            },
            '检出此提交…'
          ),
          h(
            'button',
            {
              className: 'dsv-scm-commit-menu-item',
              onClick: () => {
                setBranchFor(commitMenu.commit)
                setBranchName(``)
                setCommitMenu(null)
              }
            },
            '从此提交建分支…'
          ),
          h(
            'button',
            {
              className: 'dsv-scm-commit-menu-item',
              'data-danger': 'true',
              onClick: () => {
                const commit = commitMenu.commit
                setCommitMenu(null)
                if (!window.confirm(`撤销提交 ${commit.hash}「${commit.subject}」？\n会生成一条反向提交，已推送的内容需要再推一次。`)) return
                void runCommitAction('撤销提交', () => api.gitRevert(fullRef(commit), snap.gitRoot))
              }
            },
            '撤销此提交…'
          )
        )
      : null,

    /* 新建分支对话框 */
    branchFor
      ? h(
          'div',
          { className: 'dsv-scm-dialog-backdrop', onPointerDown: () => setBranchFor(null) },
          h(
            'div',
            { className: 'dsv-scm-dialog', onPointerDown: (event: React.PointerEvent) => event.stopPropagation() },
            h('div', { className: 'dsv-scm-dialog-title' }, `从 ${branchFor.hash} 创建分支`),
            h('input', {
              className: 'dsv-scm-dialog-input',
              value: branchName,
              autoFocus: true,
              placeholder: '分支名，例如 feature/graph',
              onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                setBranchName((event.target as HTMLInputElement).value),
              onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key === 'Escape') setBranchFor(null)
                if (event.key === 'Enter' && branchName.trim()) {
                  const commit = branchFor
                  const name = branchName.trim()
                  setBranchFor(null)
                  setBranchName('')
                  void runCommitAction('创建分支', () => api.gitCreateBranch(name, fullRef(commit), snap.gitRoot))
                }
              }
            }),
            h(
              'div',
              { className: 'dsv-scm-dialog-actions' },
              h('button', { className: 'dsv-scm-dialog-btn', onClick: () => setBranchFor(null) }, '取消'),
              h(
                'button',
                {
                  className: 'dsv-scm-dialog-btn',
                  'data-primary': 'true',
                  disabled: !branchName.trim(),
                  onClick: () => {
                    const commit = branchFor
                    const name = branchName.trim()
                    setBranchFor(null)
                    setBranchName('')
                    void runCommitAction('创建分支', () => api.gitCreateBranch(name, fullRef(commit), snap.gitRoot))
                  }
                },
                '创建'
              )
            )
          )
        )
      : null,

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
