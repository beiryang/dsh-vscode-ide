/** 「＋SSH」连接对话框：手填主机信息，首次使用不需要预配远程工作区。 */

import * as React from 'react'

import { h } from '../../h'
import { api } from '../../kernel/transport'
import { loadHosts, removeHost, saveHost, sshDialog, type SshTarget } from './sshTargets'
import { terminal } from './terminal'

export function SshDialog() {
  const open = React.useSyncExternalStore(sshDialog.subscribe, sshDialog.getSnapshot)
  const [host, setHost] = React.useState('')
  const [port, setPort] = React.useState('22')
  const [user, setUser] = React.useState('')
  const [auth, setAuth] = React.useState<'key' | 'password'>('key')
  const [keyPath, setKeyPath] = React.useState('~/.ssh/id_ed25519')
  const [password, setPassword] = React.useState('')
  const [remember, setRemember] = React.useState(true)
  const [hosts, setHosts] = React.useState<SshTarget[]>([])
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // 打开时：预填（远程工作区元数据 / 手动传入），并刷新已保存主机
  React.useEffect(() => {
    if (!open) return
    setBusy(false)
    setError(null)
    setHosts(loadHosts())
    const seed = sshDialog.getPrefill()
    if (seed) {
      setHost(seed.host ?? '')
      setPort(String(seed.port ?? 22))
      setUser(seed.user ?? '')
      setKeyPath(seed.keyPath ?? '~/.ssh/id_ed25519')
      if (seed.password) {
        setAuth('password')
        setPassword(seed.password)
      }
      return
    }
    void api
      .sshInfo()
      .then((info) => {
        if (!info) return
        setHost((current) => current || info.host)
        setPort((current) => (current && current !== '22' ? current : String(info.port || 22)))
        setUser((current) => current || info.user)
        setKeyPath((current) => (current === '~/.ssh/id_ed25519' ? info.keyPath || current : current))
      })
      .catch(() => {
        /* 拿不到元数据就用空表单 */
      })
  }, [open])

  if (!open) return null

  const target = (): SshTarget => ({
    host: host.trim(),
    port: Number(port) || 22,
    user: user.trim(),
    keyPath: auth === 'key' ? keyPath.trim() : '',
    password: auth === 'password' ? password : undefined
  })

  const connect = async (seed?: Partial<SshTarget>) => {
    if (busy) return
    const value = { ...target(), ...(seed ?? {}) }
    if (!value.host || !value.user) {
      setError('主机和用户名必填')
      return
    }
    if (!value.keyPath && !value.password) {
      setError('请填写私钥路径或密码')
      return
    }
    setBusy(true)
    setError(null)
    const message = await terminal.create(value)
    setBusy(false)
    if (message) {
      setError(message)
      return
    }
    if (remember) {
      saveHost(value)
      setHosts(loadHosts())
    }
    sshDialog.close()
  }

  const fill = (item: SshTarget) => {
    setHost(item.host)
    setPort(String(item.port || 22))
    setUser(item.user)
    setAuth('key')
    setKeyPath(item.keyPath || '~/.ssh/id_ed25519')
    setPassword('')
    setError(null)
  }

  return h(
    'div',
    { className: 'dsv-ssh-dialog', 'data-dsv-ssh-dialog': 'true' },
    h(
      'div',
      { className: 'dsv-ssh-head' },
      h('span', null, 'SSH 连接'),
      h('span', { style: { flex: 1 } }),
      h('button', { className: 'dsv-mini-btn', title: '关闭', onClick: () => sshDialog.close() }, '✕')
    ),
    hosts.length > 0
      ? h(
          'div',
          { className: 'dsv-ssh-hosts' },
          hosts.map((item) =>
            h(
              'div',
              { key: `${item.user}@${item.host}`, className: 'dsv-ssh-host', onClick: () => fill(item) },
              h('span', { className: 'dsv-ssh-host-name' }, `${item.user}@${item.host}${item.port && item.port !== 22 ? `:${item.port}` : ''}`),
              h('span', { className: 'dsv-ssh-host-key' }, item.keyPath || '密码'),
              h(
                'button',
                {
                  className: 'dsv-ssh-host-del',
                  title: '删除',
                  onClick: (event: React.MouseEvent) => {
                    event.stopPropagation()
                    removeHost(item.host, item.user)
                    setHosts(loadHosts())
                  }
                },
                '✕'
              )
            )
          )
        )
      : null,
    h(
      'div',
      { className: 'dsv-ssh-form' },
      h(
        'label',
        { className: 'dsv-ssh-field' },
        h('span', null, '主机'),
        h('input', {
          value: host,
          placeholder: '159.138.20.217 或 example.com',
          spellCheck: false,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setHost(event.target.value)
        })
      ),
      h(
        'label',
        { className: 'dsv-ssh-field dsv-ssh-narrow' },
        h('span', null, '端口'),
        h('input', {
          value: port,
          placeholder: '22',
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setPort(event.target.value)
        })
      ),
      h(
        'label',
        { className: 'dsv-ssh-field' },
        h('span', null, '用户名'),
        h('input', {
          value: user,
          placeholder: 'liu',
          spellCheck: false,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setUser(event.target.value)
        })
      ),
      h(
        'div',
        { className: 'dsv-ssh-field dsv-ssh-auth' },
        h('span', null, '认证'),
        h(
          'div',
          { className: 'dsv-ssh-row' },
          h(
            'button',
            { 'data-active': auth === 'key' ? 'true' : 'false', onClick: () => setAuth('key') },
            '私钥'
          ),
          h(
            'button',
            { 'data-active': auth === 'password' ? 'true' : 'false', onClick: () => setAuth('password') },
            '密码'
          )
        )
      ),
      auth === 'key'
        ? h(
            'label',
            { className: 'dsv-ssh-field dsv-ssh-wide' },
            h('span', null, '私钥路径'),
            h('input', {
              value: keyPath,
              placeholder: '~/.ssh/id_ed25519（留空则自动尝试 id_ed25519 / id_ecdsa / id_rsa）',
              spellCheck: false,
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => setKeyPath(event.target.value)
            })
          )
        : h(
            'label',
            { className: 'dsv-ssh-field dsv-ssh-wide' },
            h('span', null, '密码'),
            h('input', {
              type: 'password',
              value: password,
              placeholder: '只用于本次连接，不会保存',
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)
            })
          ),
      h(
        'label',
        { className: 'dsv-ssh-remember' },
        h('input', {
          type: 'checkbox',
          checked: remember,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setRemember(event.target.checked)
        }),
        h('span', null, '记住这台主机（不保存密码）')
      )
    ),
    error ? h('div', { className: 'dsv-ssh-error' }, error) : null,
    h(
      'div',
      { className: 'dsv-ssh-actions' },
      h('button', { className: 'dsv-ssh-primary', disabled: busy, onClick: () => void connect() }, busy ? '连接中…' : '连接'),
      h('button', { disabled: busy, onClick: () => sshDialog.close() }, '取消')
    )
  )
}
