# 架构：内核与 feature 的边界

这个包对外只发布**一个 npm 包**（`dsh-vscode-ide`），但内部严格分成三层。
这样既能保持"装一次就有完整工作台"，又能在将来把内核拆成 `workbench-core` 时不必重写。

```
src/client/
├─ index.tsx        装配层：挂载壳、注册 feature、发布 ctx.vscodeIde
├─ h.ts             极小的 React.createElement 包装
├─ kernel/          工作台内核（不 import 任何 feature / dsh）
│  ├─ app.tsx         根组件：主题桥、会话绑定、全局快捷键
│  ├─ window/         窗口壳：标题栏、八向缩放、侧栏容器
│  ├─ registry.ts     贡献点注册表（契约 v1）+ addStyles
│  ├─ commands.ts     命令注册/执行
│  ├─ core-commands.ts 内核自己的命令（窗口/导航/探针）
│  ├─ layout.ts       窗口几何（localStorage: dsv:layout.v1）
│  ├─ palette.ts      命令面板状态
│  ├─ sidebar.ts      侧栏当前视图（Codespace 按钮会切到「设置」）
│  ├─ files.ts        快速打开的文件索引
│  ├─ transport.ts    宿主 HTTP 客户端
│  ├─ session.ts      会话绑定
│  ├─ theme.ts        DSH 主题变量 → --dsv-*
│  ├─ probe.ts        环境探针（feature 可注册自己的诊断）
│  └─ styles.ts       内核样式（仅窗口壳/状态栏/面板等共享部分）
├─ features/        功能模块（可以 import kernel，彼此只通过 registry 通信）
│  ├─ editor/          Monaco 编辑区、标签、草稿、diff、命令、styles.ts
│  ├─ explorer/        文件树、styles.ts
│  ├─ git/             源代码管理（暂存/提交/推送）、命令、styles.ts
│  └─ terminal/        SSH 终端 + 本地 PowerShell 控制台、命令、styles.ts
└─ dsh/             DSH 插槽适配（左侧栏入口、设置页、插槽样式）
```

**每个 feature 自带三样东西**：视图组件、命令、CSS 段。删掉一个 feature 只要删目录 +
`index.tsx` 里的一行注册，内核不用改。

## 规则

1. **kernel 不 import features / assemble / dsh** —— 由 `node scripts/check-boundary.mjs` 强制，构建前自动跑。
2. **feature 之间不直接 import**，需要协作时走注册表提供的服务：
   - 打开文件 → `registry.openFile(path)`
   - 打开 diff → `registry.openDiff(left, right)`
   - 状态栏 → `registry.registerStatusItem(...)`
3. **kernel 不知道任何 feature 的业务**；窗口里出现的每个区域内容都来自注册表。

## 契约 v1（`ctx.vscodeIde`）

所有贡献都带 `apiVersion`。内核只接受 `1`，其它版本会**告警并丢弃**，不会崩。

```ts
type Region = 'sidebar' | 'main' | 'panel'

ctx.vscodeIde.registerView({
  apiVersion: 1,
  id: 'my-notes',
  title: '笔记',
  region: 'sidebar',
  order: 30,                      // 越小越靠前
  component: MyNotesView          // ({ ctx }) => ReactNode
})

ctx.vscodeIde.registerStatusItem({
  apiVersion: 1,
  id: 'my-notes.count',
  order: 30,
  render: (ctx) => `笔记 ${count}`
})

ctx.vscodeIde.registerCommand({
  id: 'my-notes.new',
  title: '笔记：新建',
  run: () => { /* ... */ }
})

ctx.vscodeIde.openFile('/path/to/file.ts')
ctx.vscodeIde.executeCommand('editor.save')
ctx.vscodeIde.listCommands()
```

视图拿到的 `ctx`（`WorkbenchContext`）是它与外界交互的唯一入口：

```ts
type WorkbenchContext = {
  sessionId: string
  cwd: string | null
  cwdError: string | null
  remote: boolean                       // 远程工作区（文件走 SFTP）
  openFile(path: string, options?: { name?: string }): void
  closeWindow(): void
  refreshWorkspace(): void
}
```

## 当前内置 feature 的注册方式

| feature | 区域 | 注册内容 |
|---|---|---|
| editor | `main` | 编辑区视图、文件/diff 打开服务、标签状态项、Monaco 探针 |
| explorer | `sidebar` | 文件树 |
| git | `sidebar` | 源代码管理 |
| terminal | `panel` | 终端面板、状态栏「终端」按钮 |

`src/client/index.tsx` 是唯一的装配点：

```ts
const disposeFeatures = [
  registerEditorFeature(),
  registerExplorerFeature(),
  registerGitFeature(),
  registerTerminalFeature()
]
```

## 什么时候拆包

- **闸门 1**：出现第一个想独立发版的第三方功能模块 → 把 `kernel/` 提成 `dsh-workbench-core`，
  本包变成第一个子项（依赖它的 peer），代码几乎不用改。
- **闸门 2**：子项 ≥ 3 且发布节奏明显不同 → 子项再各自拆包上架。
- **永远不做**：任意 JS 动态加载 + 权限模型的通用扩展宿主。

## 已完成 / 剩余欠账

K2 已完成：

- ✅ 样式按 feature 拆分：每个 `features/*/styles.ts` 导出 CSS 段，`register()` 里
  `registry.addStyles(CSS)` 注入，内核只保留窗口壳/状态栏/命令面板等共享部分。
- ✅ 命令按 feature 下移：`features/*/commands.ts`，由各自 `register()` 注册；
  内核只保留 `core-commands.ts`（窗口/导航/探针），`assemble/` 层已删除。

