/** 隐藏的启动探针：Code Space 窗口挂载时自动探测一次默认远程连接 */

import * as React from 'react'

import { ensureAutoProbe } from './remoteStatus'

export function RemoteProbe() {
  React.useEffect(() => {
    void ensureAutoProbe()
  }, [])
  return null
}
