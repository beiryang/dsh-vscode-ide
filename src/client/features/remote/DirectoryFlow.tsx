/**
 * DSH「添加工作区」目录选择流程的远程扩展。
 *
 * DSH 通过 slot `sidebar.workspaces.directoryFlow` / `conversation.hero.workspace.directoryFlow`
 * 提供目录选择；我们以更低优先级注册自己的实现，在保留本地选择的同时增加「远程目录」：
 *
 *   - 本地：宿主提供系统选择器时直接调用 DSH 原生 pickDirectory；宿主未提供时（远程访问 /
 *     反向代理部署下 DSH 合成的是应用内浏览）自动切换到应用内目录浏览，不再把
 *     `directoryPicker.pick needs the native capability` 抛给用户
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
  /** 由注册处注入：宿主合成的应用内浏览原语（宿主未合成 browse 能力时为 undefined） */
  browseLocal?: LocalBrowse
}

type Profile = { id: string; name?: string; host?: string; user?: string }
type DirEntry = { name: string; path?: string; type?: string }

/** 宿主应用内浏览的一级目录（绝对路径由宿主给出，客户端从不自己拼接）。 */
export type LocalListing = { path: string; parent?: string; entries: DirEntry[] }

/** 宿主 `directoryPicker/list` 的客户端包装，由注册处按 uiWorkspace 适配。 */
export type LocalBrowse = { list: (path?: string) => Promise<LocalListing> }

/** 宿主拒绝某个动词时带出的能力说明，两个方向都要认。 */
function isCapabilityRefusal(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /directory-picker\/unavailable|needs the (native|browse) capability/.test(message)
}

/** 失败文案：Remote 业务错误优先用它自己带的 message。 */
function failureMessage(error: unknown): string {
  if (error !== null && typeof error === 'object' && 'rpcError' in error) {
    const rpcError = (error as { rpcError?: { message?: unknown } }).rpcError
    if (rpcError && typeof rpcError.message === 'string') return rpcError.message
  }
  return error instanceof Error ? error.message : String(error)
}

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
  // 本地模式走哪条通路：unknown = 还没探测到宿主的合成结果
  const [localMode, setLocalMode] = React.useState<'unknown' | 'system' | 'browse'>('unknown')
  const [localPath, setLocalPath] = React.useState('')
  const [localParent, setLocalParent] = React.useState<string | undefined>(undefined)
  const [localEntries, setLocalEntries] = React.useState<DirEntry[]>([])
  const [localListing, setLocalListing] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      pickedOnce.current = false
      setError(null)
      setCreating(false)
      setLocalMode('unknown')
      setLocalPath('')
      setLocalParent(undefined)
      setLocalEntries([])
      setLocalListing(false)
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

  /**
   * 列一级宿主目录。返回值区分「宿主不提供 browse 能力」和「真的读失败」，
   * 探测与回退都靠它决定下一步，而不是去匹配错误文案。
   */
  const browseLocal = React.useCallback(
    async (target?: string): Promise<'ok' | 'refused' | 'failed'> => {
      const calls = props.browseLocal
      if (!calls) return 'refused'
      setLocalListing(true)
      setError(null)
      try {
        const listing = await calls.list(target)
        setLocalPath(listing.path)
        setLocalParent(listing.parent)
        setLocalEntries(listing.entries)
        return 'ok'
      } catch (cause) {
        if (isCapabilityRefusal(cause)) return 'refused'
        setError(`读取宿主目录失败：${failureMessage(cause)}`)
        return 'failed'
      } finally {
        setLocalListing(false)
      }
    },
    [props.browseLocal]
  )

  // 「本地目录」第一次出现时探测一次宿主合成结果：能列目录就是应用内浏览，
  // 被能力拒绝就是系统选择器。探测本身不打开任何系统对话框。
  React.useEffect(() => {
    if (!open || mode !== 'local' || localMode !== 'unknown') return
    if (!props.browseLocal) {
      setLocalMode('system')
      return
    }
    let cancelled = false
    void browseLocal(undefined).then((outcome) => {
      if (cancelled) return
      setLocalMode(outcome === 'refused' ? 'system' : 'browse')
    })
    return () => {
      cancelled = true
    }
  }, [open, mode, localMode, props.browseLocal, browseLocal])

  // 对话框长在侧栏/会话的 DOM 里：DSH 的侧栏滚动手势（scroll-handoff）会 preventDefault
  // 并滚动自己的滚动区，把目录列表的原生滚动一起吞掉。必须在对话框本层用原生监听截住
  // wheel（React 的合成事件挂在根容器上，晚于祖先的原生监听，来不及）。
  const backdropRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const element = backdropRef.current
    if (element === null) return
    const trapWheel = (event: WheelEvent): void => {
      event.stopPropagation()
    }
    element.addEventListener('wheel', trapWheel)
    return () => {
      element.removeEventListener('wheel', trapWheel)
    }
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
    setError(null)
    if (!props.pick) {
      if (props.browseLocal) {
        setLocalMode('browse')
        void browseLocal(undefined)
        return
      }
      setError('当前环境不支持系统文件夹选择器')
      return
    }
    try {
      const result = await props.pick()
      if (result) props.onPicked?.(result)
      else props.onCancel?.()
    } catch (cause) {
      // 宿主合成的是应用内浏览时 pick 会被明确拒绝：换通路，而不是把错误抛给用户。
      if (isCapabilityRefusal(cause) && props.browseLocal) {
        setLocalMode('browse')
        void browseLocal(undefined)
        return
      }
      setError(failureMessage(cause))
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

  // 本地标签页：宿主合成应用内浏览时渲染目录列表，系统选择器可用时保持原按钮。
  const localBody =
    localMode === 'browse'
      ? h(
          'div',
          { className: 'dsv-dirflow-body' },
          h(
            'div',
            { className: 'dsv-dirflow-hint' },
            '宿主没有提供系统文件夹选择器（远程访问 / 反向代理部署），已切换到应用内目录浏览。'
          ),
          h(
            'div',
            { className: 'dsv-dirflow-path' },
            h('input', {
              className: 'dsv-dirflow-input',
              value: localPath,
              placeholder: '宿主目录的绝对路径',
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => setLocalPath(event.target.value)
            }),
            h(
              'button',
              { className: 'dsv-dirflow-btn', disabled: localListing, onClick: () => void browseLocal(localPath) },
              localListing ? '读取中…' : '打开'
            ),
            localParent
              ? h(
                  'button',
                  {
                    className: 'dsv-dirflow-btn',
                    disabled: localListing,
                    onClick: () => void browseLocal(localParent)
                  },
                  '↑ 上一级'
                )
              : null
          ),
          h(
            'div',
            { className: 'dsv-dirflow-list' },
            localEntries.length === 0
              ? h('div', { className: 'dsv-dirflow-empty' }, localListing ? '读取中…' : '（没有子目录）')
              : localEntries.map((entry) =>
                  h(
                    'button',
                    {
                      key: entry.path || entry.name,
                      className: 'dsv-dirflow-entry',
                      onClick: () => void browseLocal(entry.path)
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
              { className: 'dsv-dirflow-btn', disabled: props.busy, onClick: () => props.onCancel?.() },
              '取消'
            ),
            h(
              'button',
              {
                className: 'dsv-dirflow-primary',
                disabled: localListing || props.busy || !localPath,
                onClick: () => props.onPicked?.(localPath)
              },
              '使用此目录'
            )
          )
        )
      : h(
          'div',
          { className: 'dsv-dirflow-body' },
          h('div', { className: 'dsv-dirflow-hint' }, '使用 DSH 自带的系统文件夹选择器选择本地目录。'),
          h(
            'button',
            { className: 'dsv-dirflow-primary', disabled: props.busy, onClick: () => void pickLocal() },
            '选择本地文件夹…'
          )
        )

  return h(
    'div',
    { className: 'dsv-dirflow-backdrop', ref: backdropRef },
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
        ? localBody
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
