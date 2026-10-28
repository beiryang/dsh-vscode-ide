/**
 * 命令注册表。
 *
 * 这是「像 VS Code 一样可扩展」的第一个公开面：任何模块（以及将来别的插件）
 * 都可以注册命令，命令面板会自动列出来。保持极小：
 *   registerCommand({ id, title, category?, keybinding?, run })
 */

export type Command = {
  id: string
  title: string
  category?: string
  /** 仅用于面板里展示的快捷键文案，例如 'Ctrl+S' */
  keybinding?: string
  run: () => void | Promise<void>
}

const commands = new Map<string, Command>()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function registerCommand(command: Command): () => void {
  commands.set(command.id, command)
  emit()
  return () => {
    if (commands.get(command.id) === command) {
      commands.delete(command.id)
      emit()
    }
  }
}

export function listCommands(): Command[] {
  return [...commands.values()]
}

export async function runCommand(id: string): Promise<boolean> {
  const command = commands.get(id)
  if (!command) return false
  try {
    await command.run()
  } catch (error) {
    console.error(`[dsh-vscode-ide] 命令 ${id} 执行失败`, error)
  }
  return true
}

export function subscribeCommands(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
