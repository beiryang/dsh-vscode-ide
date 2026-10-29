/**
 * 「＋SSH」对话框状态 + 已保存的主机列表。
 *
 * 设计取舍：
 *   - 主机、端口、用户名、私钥路径可以保存（这些不算秘密，和 ~/.ssh/config 同级）
 *   - **密码永远不落盘**，只在本次连接里用；重新打开需要重填
 */

export type SshTarget = {
  name?: string
  host: string
  port: number
  user: string
  keyPath: string
  password?: string
  passphrase?: string
}

const HOSTS_KEY = 'dsv:ssh.hosts.v1'
const listeners = new Set<() => void>()

let open = false
let prefill: Partial<SshTarget> | null = null

function publish(next: boolean) {
  if (next === open) return
  open = next
  for (const listener of listeners) listener()
}

export function loadHosts(): SshTarget[] {
  try {
    const raw = localStorage.getItem(HOSTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SshTarget[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => item && typeof item.host === 'string' && typeof item.user === 'string')
  } catch {
    return []
  }
}

export function saveHost(target: SshTarget) {
  const list = loadHosts().filter((item) => !(item.host === target.host && item.user === target.user))
  list.unshift({
    name: target.name,
    host: target.host,
    port: target.port,
    user: target.user,
    keyPath: target.keyPath
  })
  try {
    localStorage.setItem(HOSTS_KEY, JSON.stringify(list.slice(0, 30)))
  } catch {
    /* 存不下就算了 */
  }
}

export function removeHost(host: string, user: string) {
  const list = loadHosts().filter((item) => !(item.host === host && item.user === user))
  try {
    localStorage.setItem(HOSTS_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export const sshDialog = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot(): boolean {
    return open
  },
  getPrefill(): Partial<SshTarget> | null {
    return prefill
  },
  open(seed?: Partial<SshTarget>) {
    prefill = seed ?? null
    publish(true)
  },
  close() {
    prefill = null
    publish(false)
  }
}
