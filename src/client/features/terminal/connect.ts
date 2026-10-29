/**
 * 「＋SSH」的智能入口：
 *
 *   1. 当前是远程工作区 → 直接用它的元数据连，不弹任何东西
 *   2. 只记住了一台主机（且有私钥路径）→ 直接连这台，不弹窗
 *   3. 一台都没记住 / 记住了多台 → 弹对话框（列表 + 表单）
 *
 * 想强制新建或换主机时，用面板上的「▾」按钮，永远弹对话框。
 */

import { api } from '../../kernel/transport'
import { sshDialog, loadHosts } from './sshTargets'
import { terminal } from './terminal'

export async function quickConnect(): Promise<void> {
  // 1) 远程工作区元数据优先（和以前一样零配置）
  try {
    const info = await api.sshInfo()
    if (info && info.host) {
      const message = await terminal.create()
      if (!message) return
      sshDialog.open()
      return
    }
  } catch {
    /* 拿不到元数据就继续往下走 */
  }

  // 2) 只记住一台且用私钥 → 直接连
  const hosts = loadHosts()
  if (hosts.length === 1) {
    const only = hosts[0]
    if (only.keyPath) {
      const message = await terminal.create(only)
      if (!message) return
    }
    // 需要密码或连接失败 → 带着已填信息打开对话框
    sshDialog.open(only)
    return
  }

  // 3) 没有或多台 → 选择 / 新建
  sshDialog.open()
}
