/**
 * 「远程」面板：连接管理 + 远程工作区（镜像）管理。
 *
 * 数据全部走 /remote-ssh/api/*（内置 dsh-remote-ssh 宿主或外部插件均可）。
 * 创建远程工作区后，DSH 侧栏会多出该工作区，从那里打开即可。
 */

import * as React from 'react'

import { h } from '../../h'
import { remoteApi, remoteBaseName, remoteJoin, remoteParentPath } from './api'
import { probeAll, remoteStatus } from './remoteStatus'
import { getDirectoryFlowState, openDshWorkspace } from '../../kernel/dshContext'

type Profile = {
  id: string
  name: string
  host: string
  user: string
  port?: number
  keyPath?: string
  passwordConfigured?: boolean
}

type RemoteWorkspace = {
  id: string
  profileId: string
  remotePath: string
  mirrorPath: string
  title?: string
  name?: string
  /** DSH 原生工作区 id（宿主 reconcile 后可用） */
  shellWorkspaceId?: string
}

type DirEntry = { name: string; path?: string; type?: string; size?: number }

type Note = { kind: 'info' | 'error'; text: string } | null

export function RemoteView() {
  const [profiles, setProfiles] = React.useState<Profile[]>([])
  const [workspaces, setWorkspaces] = React.useState<RemoteWorkspace[]>([])
  const [loading, setLoading] = React.useState(true)
  const [note, setNote] = React.useState<Note>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [syncJob, setSyncJob] = React.useState<{ id: string; name: string } | null>(null)
  const [cancelling, setCancelling] = React.useState(false)
  const [syncDialog, setSyncDialog] = React.useState<null | {
    workspace: RemoteWorkspace
    paths: string
    exclude: string
    maxGiB: string
    force: boolean
    repairNames: boolean
  }>(null)
  const connected = React.useSyncExternalStore(remoteStatus.subscribe, remoteStatus.getSnapshot)
  const [selectedProfile, setSelectedProfile] = React.useState<string>(() => {
    try {
      return localStorage.getItem('dsv:remote.selectedProfile') ?? ''
    } catch {
      return ''
    }
  })

  React.useEffect(() => {
    if (profiles.length === 0) return
    if (!profiles.some((profile) => profile.id === selectedProfile)) setSelectedProfile(profiles[0].id)
  }, [profiles, selectedProfile])

  React.useEffect(() => {
    try {
      if (selectedProfile) localStorage.setItem('dsv:remote.selectedProfile', selectedProfile)
    } catch {
      /* ignore */
    }
  }, [selectedProfile])

  // 每次打开远程面板都重新探测（并行，各连接独立更新）
  React.useEffect(() => {
    void probeAll()
  }, [])

  const [profileForm, setProfileForm] = React.useState<null | {
    name: string
    host: string
    user: string
    port: string
    keyPath: string
    password: string
  }>(null)

  const [creating, setCreating] = React.useState(false)
  const [createProfile, setCreateProfile] = React.useState('')
  const [createPath, setCreatePath] = React.useState('')
  const [entries, setEntries] = React.useState<DirEntry[]>([])
  const [listing, setListing] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    const [profileResult, workspaceResult] = await Promise.all([
      remoteApi<{ profiles: Profile[] }>('listProfiles'),
      remoteApi<{ workspaces: RemoteWorkspace[] }>('listWorkspaces')
    ])
    setProfiles(profileResult.ok ? profileResult.value.profiles ?? [] : [])
    setWorkspaces(workspaceResult.ok ? workspaceResult.value.workspaces ?? [] : [])
    if (!profileResult.ok) setNote({ kind: 'error', text: `远程服务不可用：${profileResult.error}` })
    setLoading(false)
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const browse = async (profileId: string, path: string) => {
    if (!profileId) {
      setNote({ kind: 'error', text: '先选择一个连接配置' })
      return
    }
    setListing(true)
    const result = await remoteApi<{ path: string; entries: DirEntry[] }>('listDir', { profileId, path: path || undefined })
    setListing(false)
    if (!result.ok) {
      setNote({ kind: 'error', text: `列目录失败：${result.error}` })
      return
    }
    setCreatePath(result.value.path ?? path)
    setEntries(result.value.entries ?? [])
  }

  const normalizeHost = (raw: string) => {
    let value = raw.trim()
    value = value.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '')
    value = value.replace(/\/.*$/, '')
    return value
  }

  const saveProfile = async (afterTest = false) => {
    if (!profileForm) return
    const host = normalizeHost(profileForm.host)
    if (!host) {
      setNote({ kind: 'error', text: '主机不能为空（只需要 IP 或域名，不要带 https://）' })
      return
    }
    setBusy(afterTest ? 'save-test' : 'profile')
    const result = await remoteApi<{ profiles: Profile[] }>('saveProfile', {
      name: profileForm.name.trim(),
      host,
      user: profileForm.user.trim(),
      port: Number(profileForm.port) || 22,
      keyPath: profileForm.keyPath.trim() || undefined,
      password: profileForm.password || undefined
    })
    setBusy(null)
    if (!result.ok) {
      setNote({ kind: 'error', text: `保存连接失败：${result.error}` })
      return
    }
    setProfileForm(null)
    setNote({ kind: 'info', text: '连接已保存' })
    await load()
    if (afterTest) {
      const saved = (result.value?.profiles ?? []).find(
        (profile) => profile.host === host && profile.user === profileForm.user.trim()
      )
      if (saved) await testProfile(saved)
      else setNote({ kind: 'error', text: '连接已保存，但没有找到对应的配置，无法自动测试' })
    }
  }

  const testProfile = async (profile: Profile) => {
    setBusy(`test:${profile.id}`)
    setNote({ kind: 'info', text: `正在测试 ${profile.name || profile.host}…（最长 45 秒）` })
    try {
      const result = await remoteApi<{ stdout?: string; warning?: string; stderr?: string }>(
        'testConnection',
        { id: profile.id },
        45000
      )
      remoteStatus.mark(profile.id, result.ok)
      if (result.ok) {
        setNote({ kind: 'info', text: `连接正常${result.value.warning ? `（${result.value.warning}）` : ''}` })
      } else {
        setNote({ kind: 'error', text: `连接失败：${result.error}` })
      }
    } finally {
      setBusy(null)
    }
  }

  const deleteProfile = async (profile: Profile) => {
    if (!window.confirm(`删除连接「${profile.name}」？（不会删除远程文件）`)) return
    const result = await remoteApi('deleteProfile', { id: profile.id })
    if (!result.ok) setNote({ kind: 'error', text: `删除失败：${result.error}` })
    else void load()
  }

  const createWorkspace = async () => {
    if (!createProfile || !createPath.trim()) {
      setNote({ kind: 'error', text: '请选择连接并填写远程目录' })
      return
    }
    setBusy('create')
    const result = await remoteApi<{ mirrorPath?: string }>('createRemoteWorkspace', {
      profileId: createProfile,
      remotePath: createPath.trim()
    })
    setBusy(null)
    if (!result.ok) {
      setNote({ kind: 'error', text: `创建失败：${result.error}` })
      return
    }
    setCreating(false)
    setNote({
      kind: 'info',
      text: `已创建远程工作区，镜像：${result.value.mirrorPath || '(未知)'}。在 DSH 侧栏的会话列表里打开它即可。`
    })
    void load()
  }

  const splitList = (raw: string) =>
    raw
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)

  const sync = async (
    workspace: RemoteWorkspace,
    direction: 'down' | 'up',
    extra?: Record<string, unknown>
  ) => {
    const method = direction === 'down' ? 'syncDown' : 'syncUp'
    setBusy(`${method}:${workspace.id}`)
    setNote({ kind: 'info', text: `正在${direction === 'down' ? '拉取' : '推送'} ${remoteBaseName(workspace.remotePath)}…` })
    if (direction === 'down') setSyncJob({ id: workspace.id, name: remoteBaseName(workspace.remotePath) })
    try {
      const result = await remoteApi(method, { id: workspace.id, ...extra }, 900000)
      if (!result.ok) setNote({ kind: 'error', text: `${direction === 'down' ? '拉取' : '推送'}失败：${result.error}` })
      else setNote({ kind: 'info', text: `${direction === 'down' ? '已拉取到本地镜像' : '已推送回远程'}` })
    } finally {
      setBusy(null)
      setSyncJob(null)
      setCancelling(false)
    }
  }

  const cancelSync = async () => {
    if (!syncJob || cancelling) return
    setCancelling(true)
    const result = await remoteApi('cancelSync', { id: syncJob.id }, 15000)
    if (!result.ok) {
      setCancelling(false)
      setNote({ kind: 'error', text: `取消失败：${result.error}` })
      return
    }
    setNote({ kind: 'info', text: '已请求取消拉取，正在清理临时文件…' })
  }

  const removeWorkspace = async (workspace: RemoteWorkspace) => {
    if (!window.confirm(`移除远程工作区「${remoteBaseName(workspace.remotePath)}」？（只移除登记，不动远端/镜像文件）`))
      return
    const result = await remoteApi('deleteWorkspace', { id: workspace.id })
    if (!result.ok) setNote({ kind: 'error', text: `移除失败：${result.error}` })
    else void load()
  }

  return h(
    'div',
    { className: 'dsv-panel dsv-remote' },
    h(
      'div',
      { className: 'dsv-panel-head' },
      h('span', null, '远程'),
      h('span', { style: { flex: 1 } }),
      loading ? h('span', { className: 'dsv-remote-dim' }, '加载中…') : null,
      h('button', { className: 'dsv-mini-btn', title: '刷新', onClick: () => void load() }, '↻')
    ),
    note
      ? h(
          'div',
          { className: 'dsv-remote-note', 'data-kind': note.kind },
          note.text,
          h('button', { className: 'dsv-remote-note-close', title: '关闭', onClick: () => setNote(null) }, '✕')
        )
      : null,

    h(
      'div',
      { className: 'dsv-remote-section' },
      h(
        'div',
        { className: 'dsv-remote-section-head' },
        h('span', null, '连接'),
        h('span', { style: { flex: 1 } }),
        h(
          'button',
          {
            className: 'dsv-remote-act dsv-remote-act-text dsv-remote-toggle',
            title: '新建 SSH 连接',
            onClick: () =>
              setProfileForm((previous) =>
                previous ? null : { name: '', host: '', user: '', port: '22', keyPath: '', password: '' }
              )
          },
          profileForm ? '取消' : '＋'
        )
      ),
      profileForm
        ? h(
            'div',
            { className: 'dsv-remote-form' },
            h('input', {
              className: 'dsv-remote-input',
              placeholder: '名称（如 ECS）',
              value: profileForm.name,
              onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                setProfileForm((previous) => (previous ? { ...previous, name: event.target.value } : previous))
            }),
            h('input', {
              className: 'dsv-remote-input',
              placeholder: '主机（IP 或域名）',
              value: profileForm.host,
              onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                setProfileForm((previous) => (previous ? { ...previous, host: event.target.value } : previous))
            }),
            h(
              'div',
              { className: 'dsv-remote-form-row' },
              h('input', {
                className: 'dsv-remote-input',
                placeholder: '用户名',
                value: profileForm.user,
                onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                  setProfileForm((previous) => (previous ? { ...previous, user: event.target.value } : previous))
              }),
              h('input', {
                className: 'dsv-remote-input',
                placeholder: '端口',
                value: profileForm.port,
                onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                  setProfileForm((previous) => (previous ? { ...previous, port: event.target.value } : previous))
              })
            ),
            h('input', {
              className: 'dsv-remote-input',
              placeholder: '密码（可空；留空则用私钥）',
              type: 'password',
              value: profileForm.password,
              onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                setProfileForm((previous) => (previous ? { ...previous, password: event.target.value } : previous))
            }),
            h('input', {
              className: 'dsv-remote-input',
              placeholder: '私钥路径（可空，默认 ~/.ssh/id_ed25519 等）',
              value: profileForm.keyPath,
              onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                setProfileForm((previous) => (previous ? { ...previous, keyPath: event.target.value } : previous))
            }),
            h(
              'div',
              { className: 'dsv-remote-form-row' },
              h(
                'button',
                {
                  className: 'dsv-remote-primary',
                  disabled:
                    busy === 'profile' || busy === 'save-test' || !profileForm.name.trim() || !profileForm.host.trim() || !profileForm.user.trim(),
                  onClick: () => void saveProfile(false)
                },
                busy === 'profile' ? '保存中…' : '保存连接'
              ),
              h(
                'button',
                {
                  className: 'dsv-remote-act dsv-remote-act-text',
                  disabled:
                    busy === 'profile' || busy === 'save-test' || !profileForm.name.trim() || !profileForm.host.trim() || !profileForm.user.trim(),
                  onClick: () => void saveProfile(true)
                },
                busy === 'save-test' ? '测试中…' : '保存并测试'
              )
            ),
            h('div', { className: 'dsv-remote-hint' }, '保存成功后，连接行尾会出现「测试 / 删除」按钮')
          )
        : null,
      profiles.length === 0
        ? h('div', { className: 'dsv-remote-empty' }, '还没有远程连接。点「＋」填名称/主机/用户，保存后行尾会出现「测试」。')
        : profiles.map((profile) =>
            h(
              'div',
              {
                className: 'dsv-remote-row dsv-remote-profile',
                key: profile.id,
                'data-selected': selectedProfile === profile.id ? 'true' : 'false',
                onClick: () => setSelectedProfile(profile.id)
              },
              h(
                'span',
                {
                  className: 'dsv-remote-dot',
                  'data-ok': connected[profile.id] ? 'true' : 'false',
                  title: connected[profile.id] ? '最近一次探测/测试成功' : '尚未探测或探测失败'
                },
                '●'
              ),
              h('span', { className: 'dsv-remote-name', title: `${profile.user}@${profile.host}` }, profile.name || profile.host),
              h('span', { className: 'dsv-remote-meta' }, `${profile.user}@${profile.host}${profile.port ? `:${profile.port}` : ''}`),
              selectedProfile === profile.id ? h('span', { className: 'dsv-remote-current' }, '当前') : null,
              h(
                'button',
                {
                  className: 'dsv-remote-act dsv-remote-act-text',
                  title: '测试连接',
                  disabled: busy === `test:${profile.id}`,
                  onClick: (event: React.MouseEvent) => {
                    event.stopPropagation()
                    void testProfile(profile)
                  }
                },
                busy === `test:${profile.id}` ? '测试中…' : '测试'
              ),
              h(
                'button',
                {
                  className: 'dsv-remote-act dsv-remote-act-text',
                  title: '删除连接',
                  onClick: (event: React.MouseEvent) => {
                    event.stopPropagation()
                    void deleteProfile(profile)
                  }
                },
                '删除'
              )
            )
          )
    ),

    syncJob
      ? h(
          'div',
          { className: 'dsv-remote-syncbar' },
          h('span', { className: 'dsv-remote-syncbar-text' }, `正在拉取 ${syncJob.name}…`),
          h(
            'button',
            { className: 'dsv-remote-syncbar-cancel', disabled: cancelling, onClick: () => void cancelSync() },
            cancelling ? '取消中…' : '取消'
          )
        )
      : null,
    h(
      'div',
      { className: 'dsv-remote-section' },
      h(
        'div',
        { className: 'dsv-remote-section-head' },
        h('span', null, '远程工作区'),
        h('span', { style: { flex: 1 } }),
        h(
          'button',
          {
            className: 'dsv-remote-act dsv-remote-act-text dsv-remote-toggle',
            title: '新建远程工作区（创建本地镜像）',
            onClick: () =>
              setCreating((previous) => {
                const next = !previous
                if (next) setCreateProfile(selectedProfile || profiles[0]?.id || '')
                return next
              })
          },
          creating ? '取消' : '＋'
        )
      ),
      creating
        ? h(
            'div',
            { className: 'dsv-remote-form' },
            h(
              'select',
              {
                className: 'dsv-remote-input',
                value: createProfile,
                onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
                  setCreateProfile(event.target.value)
                  setEntries([])
                }
              },
              h('option', { value: '' }, '选择连接…'),
              profiles.map((profile) => h('option', { key: profile.id, value: profile.id }, profile.name || profile.host))
            ),
            h(
              'div',
              { className: 'dsv-remote-path-row' },
              h('input', {
                className: 'dsv-remote-input dsv-remote-path-input',
                placeholder: '远程目录，如 /home/you/workflow',
                value: createPath,
                onChange: (event: React.ChangeEvent<HTMLInputElement>) => setCreatePath(event.target.value)
              }),
              h(
                'button',
                {
                  className: 'dsv-remote-primary dsv-remote-browse',
                  disabled: listing || !createProfile,
                  onClick: () => void browse(createProfile, createPath)
                },
                listing ? '浏览中…' : '浏览'
              )
            ),
            h(
              'button',
              {
                className: 'dsv-remote-primary dsv-remote-primary-block',
                disabled: busy === 'create' || !createProfile || !createPath.trim(),
                onClick: () => void createWorkspace()
              },
              busy === 'create' ? '创建中…' : '创建并登记'
            ),
            entries.length > 0 || remoteParentPath(createPath)
              ? h(
                  'div',
                  { className: 'dsv-remote-entries' },
                  remoteParentPath(createPath)
                    ? h(
                        'button',
                        {
                          className: 'dsv-remote-entry',
                          onClick: () => void browse(createProfile, remoteParentPath(createPath) as string)
                        },
                        '↰ 上一级'
                      )
                    : null,
                  entries
                    .filter((entry) => entry.type === 'directory')
                    .slice(0, 40)
                    .map((entry) =>
                      h(
                        'button',
                        {
                          key: entry.name,
                          className: 'dsv-remote-entry',
                          onClick: () => void browse(createProfile, entry.path || remoteJoin(createPath, entry.name))
                        },
                        `▸ ${entry.name}`
                      )
                    )
                )
              : null,
            h('div', { className: 'dsv-remote-hint' }, '创建后 DSH 侧栏会出现该工作区；从那里打开即可在 Code Space 里编辑。')
          )
        : null,
      workspaces.length === 0
        ? h('div', { className: 'dsv-remote-empty' }, '还没有远程工作区。点「＋」选择连接和远程目录。')
        : workspaces.map((workspace) =>
            h(
              'div',
              {
                className: 'dsv-remote-row dsv-remote-ws',
                key: workspace.id,
                title: '点击打开该镜像工作区',
                onClick: () => {
                  const id = workspace.shellWorkspaceId || ''
                  if (!id) {
                    setNote({ kind: 'error', text: '没有找到该工作区的原生 id，请先在 DSH 侧栏打开一次' })
                    return
                  }
                  const opened = openDshWorkspace(id)
                  if (!opened.ok) setNote({ kind: 'error', text: `打开工作区失败：${opened.error}` })
                }
              },
              h(
                'span',
                {
                  className: 'dsv-remote-dot',
                  'data-ok': connected[workspace.profileId] ? 'true' : 'false',
                  title: connected[workspace.profileId] ? '所属连接最近一次探测成功' : '所属连接尚未探测或探测失败'
                },
                '●'
              ),
              h(
                'span',
                { className: 'dsv-remote-name', title: workspace.remotePath },
                remoteBaseName(workspace.remotePath)
              ),
              h('span', { className: 'dsv-remote-meta', title: workspace.mirrorPath }, workspace.remotePath),
              h(
                'button',
                {
                  className: 'dsv-remote-act',
                  title: '同步选项（范围 / 排除 / 上限 / force）',
                  onClick: (event: React.MouseEvent) => {
                    event.stopPropagation()
                    setSyncDialog({
                      workspace,
                      paths: '',
                      exclude: '',
                      maxGiB: '',
                      force: false,
                      repairNames: false
                    })
                  }
                },
                '⋯'
              ),
              h(
                'button',
                {
                  className: 'dsv-remote-act',
                  title: '从远程拉取到本地镜像',
                  disabled: busy === `syncDown:${workspace.id}`,
                  onClick: (event: React.MouseEvent) => { event.stopPropagation(); void sync(workspace, 'down') }
                },
                busy === `syncDown:${workspace.id}` ? '…' : '⬇'
              ),
              h(
                'button',
                {
                  className: 'dsv-remote-act',
                  title: '移除登记',
                  onClick: (event: React.MouseEvent) => {
                    event.stopPropagation()
                    void removeWorkspace(workspace)
                  }
                },
                '✕'
              )
            )
          )
    ),

    syncDialog
      ? h(
          'div',
          { className: 'dsv-sync-backdrop' },
          h(
            'div',
            { className: 'dsv-sync-dlg' },
            h('div', { className: 'dsv-sync-head' }, `拉取选项 · ${remoteBaseName(syncDialog.workspace.remotePath)}`),
            h(
              'label',
              { className: 'dsv-sync-field' },
              '同步范围（相对远端根，逗号/换行分隔；留空 = 整树，强烈建议填写）',
              h('textarea', {
                className: 'dsv-sync-input',
                rows: 2,
                value: syncDialog.paths,
                placeholder: '.dsh 或 src,docs',
                onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setSyncDialog((previous) => (previous ? { ...previous, paths: event.target.value } : previous))
              })
            ),
            h(
              'label',
              { className: 'dsv-sync-field' },
              '排除（相对远端根，支持 *，逗号/换行分隔）',
              h('textarea', {
                className: 'dsv-sync-input',
                rows: 2,
                value: syncDialog.exclude,
                placeholder: 'data,*.log',
                onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setSyncDialog((previous) => (previous ? { ...previous, exclude: event.target.value } : previous))
              })
            ),
            h(
              'label',
              { className: 'dsv-sync-field' },
              '体积上限（GiB，留空 = 默认 2 GiB）',
              h('input', {
                className: 'dsv-sync-input',
                value: syncDialog.maxGiB,
                placeholder: '2',
                onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                  setSyncDialog((previous) => (previous ? { ...previous, maxGiB: event.target.value } : previous))
              })
            ),
            h(
              'label',
              { className: 'dsv-sync-check' },
              h('input', {
                type: 'checkbox',
                checked: syncDialog.force,
                onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                  setSyncDialog((previous) => (previous ? { ...previous, force: event.target.checked } : previous))
              }),
              '强制整树（跳过体积哨兵与“仅镜像存在”保护）'
            ),
            h(
              'label',
              { className: 'dsv-sync-check' },
              h('input', {
                type: 'checkbox',
                checked: syncDialog.repairNames,
                onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                  setSyncDialog((previous) => (previous ? { ...previous, repairNames: event.target.checked } : previous))
              }),
              '修复旧版本乱码文件名（repairNames）'
            ),
            h(
              'div',
              { className: 'dsv-sync-actions' },
              h('button', { className: 'dsv-sync-btn', onClick: () => setSyncDialog(null) }, '取消'),
              h(
                'button',
                {
                  className: 'dsv-sync-btn dsv-sync-primary',
                  onClick: () => {
                    const current = syncDialog
                    setSyncDialog(null)
                    void sync(current.workspace, 'down', {
                      paths: splitList(current.paths).length ? splitList(current.paths) : undefined,
                      exclude: splitList(current.exclude).length ? splitList(current.exclude) : undefined,
                      maxBytes: Number(current.maxGiB) > 0 ? Math.round(Number(current.maxGiB) * 1024 ** 3) : undefined,
                      force: current.force || undefined,
                      repairNames: current.repairNames || undefined
                    })
                  }
                },
                '⬇ 拉取'
              )
            )
          )
        )
      : null,
    h(
      'div',
      { className: 'dsv-remote-hint dsv-remote-foot' },
      `远程服务由内置兼容层或已安装的 dsh-remote-ssh 提供 · 目录流程：${getDirectoryFlowState()}`
    )
  )
}
