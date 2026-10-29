/** 选择 Git 仓库目录：工作区根不是仓库时，指定子目录（本地 / 远程通用）。 */

import * as React from 'react'

import { h } from '../../h'
import { api } from '../../kernel/transport'
import { git } from './git'
import { gitRootDialog } from './rootDialog'

export function GitRootDialog({ remote }: { remote?: boolean }) {
  const open = React.useSyncExternalStore(gitRootDialog.subscribe, gitRootDialog.getSnapshot)
  const snapshot = React.useSyncExternalStore(git.subscribe, git.getSnapshot)
  const [repos, setRepos] = React.useState<string[]>([])
  const [manual, setManual] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setManual(snapshot.gitRoot)
    setError(null)
    setBusy(true)
    void api
      .gitCandidates(snapshot.gitRoot)
      .then((result) => setRepos(result.repos))
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setBusy(false))
  }, [open, snapshot.gitRoot])

  if (!open) return null

  const apply = (value: string) => {
    git.setRoot(value)
    gitRootDialog.close()
  }

  return h(
    'div',
    { className: 'dsv-gitroot-dialog', 'data-dsv-gitroot-dialog': 'true' },
    h(
      'div',
      { className: 'dsv-gitroot-head' },
      h('span', null, '选择 Git 仓库目录'),
      h('span', { style: { flex: 1 } }),
      h('button', { className: 'dsv-mini-btn', title: '关闭', onClick: () => gitRootDialog.close() }, '✕')
    ),
    h(
      'div',
      { className: 'dsv-gitroot-hint' },
      remote
        ? '当前是远程工作区：这里列的是服务器上找到的仓库目录，命令仍会在服务器执行。'
        : '工作区根不是仓库时，可以指定里面某个子目录作为 Git 目录。'
    ),
    busy
      ? h('div', { className: 'dsv-gitroot-hint' }, '正在扫描…')
      : repos.length === 0
        ? h('div', { className: 'dsv-gitroot-hint' }, '没有扫描到 Git 仓库（.git）。可以在下面手动填写相对路径。')
        : h(
            'div',
            { className: 'dsv-gitroot-list' },
            repos.map((repo) =>
              h(
                'button',
                {
                  key: repo || '(root)',
                  className: 'dsv-gitroot-item',
                  'data-active': snapshot.gitRoot === repo ? 'true' : 'false',
                  title: repo || '工作区根目录',
                  onClick: () => apply(repo)
                },
                h('span', { className: 'dsv-gitroot-item-icon' }, '⎇'),
                repo || '工作区根目录'
              )
            )
          ),
    h(
      'div',
      { className: 'dsv-gitroot-manual' },
      h('input', {
        className: 'dsv-gitroot-input',
        value: manual,
        spellCheck: false,
        placeholder: '相对路径，例如 app 或 packages/core（留空 = 工作区根）',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setManual(event.target.value),
        onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            apply(manual.trim())
          }
        }
      })
    ),
    error ? h('div', { className: 'dsv-gitroot-error' }, error) : null,
    h(
      'div',
      { className: 'dsv-gitroot-actions' },
      h('button', { className: 'dsv-gitroot-primary', onClick: () => apply(manual.trim()) }, '使用这个目录'),
      h('button', { onClick: () => apply('') }, '恢复工作区根'),
      h('button', { onClick: () => gitRootDialog.close() }, '取消')
    )
  )
}
