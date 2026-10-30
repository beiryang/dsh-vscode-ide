/**
 * DSH「添加工作区」目录选择流程的远程扩展。
 *
 * DSH 通过 slot `sidebar.workspaces.directoryFlow` / `conversation.hero.workspace.directoryFlow`
 * 提供目录选择；我们以更低优先级注册自己的实现，在保留本地选择的同时增加「远程目录」：
 *
 *   - 本地：直接调用 DSH 原生 pickDirectory（系统文件夹选择器）
 *   - 远程：选择连接 → 浏览远端目录 → createRemoteWorkspace → 用镜像路径回调 onPicked，
 *     后续创建工作区/打开会话完全交回 DSH 原生流程。
 */

import * as React from 'react'

import { h } from '../../h'
import { remoteApi, remoteJoin, remoteParentPath } from './api'

type FlowProps = {
  open?: boolean
  busy?: boolean
  onPicked?: (path: string) => void
  onCancel?: () => void
  onError?: (message: string) => void
  /** 由注册处注入：DSH 原生文件夹选择器 */
  pick?: () => Promise<string | null>
}

type Profile = { id: string; name?: string; host?: string; user?: string }
type DirEntry = { name: string; path?: string; type?: string }

export function DirectoryFlow(props: FlowProps) {
  const open = props.open === true
  const [mode, setMode] = React.useState<'local' | 'remote'>('remote')
  const [profiles, setProfiles] = React.useState<Profile[]>([])
  const [profileId, setProfileId] = React.useState('')
  const [path, setPath] = React.useState('')
  const [entries, setEntries] = React.useState<DirEntry[]>([])
  const [syncPaths, setSyncPaths] = React.useState('')
  const [listing, setListing] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const pickedOnce = React.useRef(false)

  React.useEffect(() => {
    if (!open) {
      pickedOnce.current = false
      setError(null)
      setCreating(false)
      return
    }
    setMode('remote')
    setError(null)
    void remoteApi<{ profiles: Profile[] }>('listProfiles', undefined, 8000).then((result) => {
      if (!result.ok) {
        setError(`读取连接列表失败：${result.error}`)
        return
      }
      const list = result.value.profiles ?? []
      setProfiles(list)
      let preferred = ''
      try {
        preferred = localStorage.getItem('dsv:remote.selectedProfile') ?? ''
      } catch {
        preferred = ''
      }
      const chosen = list.find((profile) => profile.id === preferred) ?? list[0]
      setProfileId(chosen?.id ?? '')
    })
  }, [open])

  const browse = React.useCallback(
    async (id: string, target: string) => {
      if (!id) {
        setError('先选择一个连接')
        return
      }
      setListing(true)
      setError(null)
      const result = await remoteApi<{ path: string; entries: DirEntry[] }>('listDir', {
        profileId: id,
        path: target || undefined
      })
      setListing(false)
      if (!result.ok) {
        setError(`读取远端目录失败：${result.error}`)
        return
      }
      setPath(result.value.path ?? target)
      setEntries(result.value.entries ?? [])
    },
    []
  )

  // 选好连接后自动列一次目录
  React.useEffect(() => {
    if (open && profileId && !pickedOnce.current) {
      pickedOnce.current = true
      void browse(profileId, path)
    }
  }, [open, profileId, path, browse])

  if (!open) return null

  const pickLocal = async () => {
    if (!props.pick) {
      setError('当前环境不支持系统文件夹选择器')
      return
    }
    setError(null)
    try {
      const result = await props.pick()
      if (result) props.onPicked?.(result)
      else props.onCancel?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const createRemote = async () => {
    if (!profileId || !path.trim()) {
      setError('请选择连接并打开一个远端目录')
      return
    }
    setCreating(true)
    setError(null)
    const scope = syncPaths
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)
    const result = await remoteApi<{ mirrorPath?: string; error?: string }>(
      'createRemoteWorkspace',
      { profileId, remotePath: path.trim(), syncPaths: scope.length ? scope : undefined },
      600000
    )
    setCreating(false)
    if (!result.ok || !result.value?.mirrorPath) {
      const message = result.ok ? '创建远程工作区失败（没有返回镜像路径）' : result.error
      setError(message)
      props.onError?.(message)
      return
    }
    props.onPicked?.(result.value.mirrorPath)
  }

  const parent = remoteParentPath(path)
  const dirs = entries.filter((entry) => entry.type === 'directory')

  return h(
    'div',
    { className: 'dsv-dirflow-backdrop' },
    h(
      'div',
      { className: 'dsv-dirflow' },
      h(
        'div',
        { className: 'dsv-dirflow-head' },
        h('span', null, '添加工作区'),
        h('span', { style: { flex: 1 } }),
        h('button', { className: 'dsv-dirflow-close', title: '取消', onClick: () => props.onCancel?.() }, '✕')
      ),
      h(
        'div',
        { className: 'dsv-dirflow-tabs' },
        h(
          'button',
          {
            className: 'dsv-dirflow-tab',
            'data-active': mode === 'local' ? 'true' : 'false',
            onClick: () => setMode('local'),
            disabled: props.busy || creating
          },
          '🗀 本地目录'
        ),
        h(
          'button',
          {
            className: 'dsv-dirflow-tab',
            'data-active': mode === 'remote' ? 'true' : 'false',
            onClick: () => {
              setMode('remote')
              if (profileId && entries.length === 0) void browse(profileId, path)
            },
            disabled: props.busy || creating
          },
          '🌐 远程目录'
        )
      ),

      mode === 'local'
        ? h(
            'div',
            { className: 'dsv-dirflow-body' },
            h('div', { className: 'dsv-dirflow-hint' }, '使用 DSH 自带的系统文件夹选择器选择本地目录。'),
            h(
              'button',
              { className: 'dsv-dirflow-primary', disabled: props.busy, onClick: () => void pickLocal() },
              '选择本地文件夹…'
            )
          )
        : h(
            'div',
            { className: 'dsv-dirflow-body' },
            h(
              'div',
              { className: 'dsv-dirflow-field' },
              h('span', { className: 'dsv-dirflow-label' }, '连接配置'),
              h(
                'select',
                {
                  className: 'dsv-dirflow-input',
                  value: profileId,
                  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
                    const id = event.target.value
                    setProfileId(id)
                    setEntries([])
                    setPath('')
                    if (id) void browse(id, '')
                  },
                  disabled: creating
                },
                profiles.length === 0 ? h('option', { value: '' }, '（没有连接，请先在 DSH 设置里添加）') : null,
                profiles.map((profile) =>
                  h('option', { key: profile.id, value: profile.id }, profile.name || profile.host)
                )
              )
            ),
            h(
              'div',
              { className: 'dsv-dirflow-field' },
              h('span', { className: 'dsv-dirflow-label' }, '同步范围（可选，留空 = 整树）'),
              h('input', {
                className: 'dsv-dirflow-input',
                value: syncPaths,
                placeholder: '例如 .dsh 或 src,docs',
                onChange: (event: React.ChangeEvent<HTMLInputElement>) => setSyncPaths(event.target.value)
              })
            ),
            h(
              'div',
              { className: 'dsv-dirflow-path' },
              h('input', {
                className: 'dsv-dirflow-input',
                value: path,
                placeholder: '~/workflow',
                onChange: (event: React.ChangeEvent<HTMLInputElement>) => setPath(event.target.value)
              }),
              h(
                'button',
                { className: 'dsv-dirflow-btn', disabled: listing, onClick: () => void browse(profileId, path) },
                listing ? '读取中…' : '打开'
              ),
              parent
                ? h(
                    'button',
                    { className: 'dsv-dirflow-btn', disabled: listing, onClick: () => void browse(profileId, parent) },
                    '↑ 上一级'
                  )
                : null
            ),
            h(
              'div',
              { className: 'dsv-dirflow-list' },
              dirs.length === 0
                ? h('div', { className: 'dsv-dirflow-empty' }, listing ? '读取中…' : '（没有子目录）')
                : dirs.map((entry) =>
                    h(
                      'button',
                      {
                        key: entry.path || entry.name,
                        className: 'dsv-dirflow-entry',
                        onClick: () => void browse(profileId, entry.path || remoteJoin(path, entry.name))
                      },
                      `📁 ${entry.name}`
                    )
                  )
            ),
            h(
              'div',
              { className: 'dsv-dirflow-foot' },
              h(
                'button',
                { className: 'dsv-dirflow-btn', disabled: creating, onClick: () => props.onCancel?.() },
                '取消'
              ),
              h(
                'button',
                { className: 'dsv-dirflow-primary', disabled: creating || props.busy || !profileId, onClick: () => void createRemote() },
                creating ? '创建中…' : '创建并打开工作区'
              )
            )
          ),

      error ? h('div', { className: 'dsv-dirflow-error' }, error) : null
    )
  )
}
