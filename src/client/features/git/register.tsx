/** 源代码管理 feature：侧栏「源代码管理」视图 + Git 命令。 */

import { h } from '../../h'
import { registry, type WorkbenchContext } from '../../kernel/registry'
import { registerGitCommands } from './commands'
import { CSS } from './styles'
import { SourceControl } from './SourceControl'

function GitView({ ctx }: { ctx: WorkbenchContext }) {
  return h(SourceControl, { cwd: ctx.cwd, remote: ctx.remote })
}

export function registerGitFeature(): () => void {
  const disposers = [
    registry.addStyles(CSS),
    registry.registerView({
      apiVersion: 1,
      id: 'scm',
      title: '源代码管理',
      region: 'sidebar',
      order: 20,
      component: GitView
    }),
    registerGitCommands()
  ]
  return () => {
    for (const dispose of disposers) {
      try {
        dispose()
      } catch {
        /* ignore */
      }
    }
  }
}
