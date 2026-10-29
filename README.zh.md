# dsh-vscode-ide

**DSH 里的 VS Code 式工作台**：Monaco 编辑器内核 + 独立浮动工作台窗口 + 按需加载的功能模块。

> 不是 VS Code 移植，也不加载 `.vsix` 扩展；它是一个**轻量工作台**——把 VS Code 里真正每天用的那部分（快速打开、多标签、查找替换、diff、命令面板、主题）搬进 DSH，其余按需再加。

## 截图

![工作台：文件树、Monaco 编辑器与 SSH 终端同处一个浮动窗口](docs/screenshots/workbench.png)

| | |
|---|---|
| ![跟随会话工作区的文件树](docs/screenshots/explorer.png) | ![源代码管理与命令面板](docs/screenshots/palette.png) |
| ![与 HEAD 比较的 diff](docs/screenshots/diff.png) | ![基于 xterm.js 的 SSH 终端](docs/screenshots/ssh.png) |

![设置页：主题、编辑器字体、主题与图标导入、诊断](docs/screenshots/settings.png)

## 和市场上同类插件的区别

| | 形态 | 编辑器 | 扩展能力 | 包体积 |
|---|---|---|---|---|
| **dsh-vscode-ide**（本项目） | 独立浮动工作台，不挤对话区 | **Monaco**（VS Code 同款内核） | 内置模块按需加载 + 公开 `ctx.vscodeIde` 服务 | 默认集约 11 MB |
| `dsh-vscode-mode` | 驻 DSH 右侧 Sidebar | Monaco | LSP + SVN + 代码片段 + 扩展管理 | 约 27 MB |
| `dsh-ide` / `dsh-workbench` / `dsh-ide-vscode` | 驻右侧栏 | CodeMirror | 文件树 / Git 审查 | 1～3 MB |
| dock 系列 | 独立 dock 轨道 | CodeMirror | 拆成 6 个包，按需装 | 每个 0.1～1 MB |

取舍很明确：**要 VS Code 的编辑手感（Monaco），但不要 VS Code 的体量（扩展宿主/LSP/SVN）**；界面是独立浮窗，不抢 DSH 的右侧栏。

## 架构

三层 + 强制边界，详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)：

```
kernel/   工作台内核：窗口壳、布局、命令面板、注册表、主题（不 import 任何 feature）
features/ 功能模块：editor / explorer / git / terminal（各自带视图、命令、样式）
dsh/      DSH 插槽适配：左侧栏入口、设置页分区
```

`kernel` 越界会被 `node scripts/check-boundary.mjs` 拦下（构建前自动执行）。
第三方插件的接入点已经以契约 v1 的形式暴露为 `ctx.vscodeIde`（视图 / 状态项 / 命令 / 打开文件），
所有贡献都带 `apiVersion`，内核只接受 `1`。

## 当前状态：1.0.0

- ✅ 独立浮窗壳：拖动、八向缩放、最大化、几何记忆（`localStorage: dsv:layout.v1`）；最大化时顶部让出 44px，永远退得出来
- ✅ 左侧栏「Code Space」入口（点击开/关工作台）+ DSH 设置页分区（走 `sidebar.panellist` / `settings.section` 插槽）
- ✅ 速览：`Ctrl+Alt+Q` 临时藏起工作台看对话，再按原样回来（不丢编辑器状态）；可拖动浮钮提供鼠标入口
- ✅ 文件树：跟随当前会话工作目录，按需展开；**远程工作区自动走 SFTP**
- ✅ Monaco 编辑器：ESM 预打包、按需加载；每文件一个 `ITextModel`，切标签不丢未保存内容
- ✅ 保存：`Ctrl+S`（临时文件 + rename 原子写）、`Ctrl+W` 关标签、脏标记与关闭确认
- ✅ 查找替换：Monaco 自带 widget（`Ctrl+F`）
- ✅ 快速打开 `Ctrl+Alt+P` / 命令面板 `Ctrl+Alt+Shift+P`（`Ctrl+P` 被 DSH 占用）
- ✅ 全局搜索 `Ctrl+Alt+Shift+F`：**浮动搜索面板**（不占侧栏，Esc 关闭），整工作区搜内容、按文件分组、点击跳到对应行；Git 仓库走 `git grep`，其余遍历（远程工作区暂不支持）
- ✅ 草稿恢复（hot exit）：未保存内容写 `localStorage: dsv:drafts.v1`，重启后自动接回并保留脏标记
- ✅ Diff 视图：与磁盘版本比较 / 与 HEAD 比较 / 比较两个文件
- ✅ Git：分支与变更列表、diff、逐文件暂存、全部暂存、提交、推送（无上游时自动 publish）
- ✅ SSH 终端：xterm.js，多会话、拖动改高度，连接信息复用 `dsh-remote-ssh` 的工作区元数据
- ✅ 本地 PowerShell 命令控制台（非 PTY，不支持 vim/top 等全屏程序）
- ✅ 主题：跟随 DSH / One Dark Pro / **导入任意 VS Code 主题 JSON**（编辑器与外壳一起换皮）
- ✅ 图标：内置 Material Icon Theme，**可导入任意 VS Code 图标主题**（构建期合成 sprite，懒加载）
- ✅ 设置：编辑器字体、终端字号、主题与图标导入、宿主诊断，全部带持久化
- ✅ 环境探针：`await __dsv.probe()`，`probe(true)` 落盘

## 安装

> npm 尚未发布（注册受地区风控限制），当前请用 GitHub Release 里的安装包。

### 从 GitHub Release 安装（推荐）

1. 到 [Releases](https://github.com/beiryang/dsh-vscode-ide/releases) 下载 `dsh-vscode-ide-1.0.0.tgz`
2. 解压并运行自带的安装器：

```powershell
tar -xzf dsh-vscode-ide-1.0.0.tgz
cd package
node install.mjs
```

`install.mjs` 会自动找到已装有本插件的 profile；要指定目录就加 `--profile "<目录>"`。

3. **完全退出 DSH**（托盘图标 → 退出）再打开——客户端 bundle 只在启动时加载。

### 从源码安装（开发）

```powershell
npm install
npm run build                     # 必须：vendor/ 与 lib/client.js 不在仓库里
node install.mjs
```

### npm（发布后）

```sh
dsh plugin --profile web add dsh-vscode-ide
```

### 卸载（保留 `localStorage` 里的窗口几何等用户数据）

```powershell
node install.mjs --remove
```

## 使用

- 左侧栏点 **Code Space**：开 / 关工作台（再次点击关闭，窗口跑到屏幕外也能关掉）
- `Ctrl+Alt+I` 开关工作台、`Ctrl+Alt+Q` 速览（临时藏起工作台看对话，再按回来）
- 屏幕上的浮钮「对话」：等价 `Ctrl+Alt+Q`，可拖动到顺手位置，位置会记住
- 标题栏：拖动移动、`⌕` 转到文件、`>` 命令面板、`↻` 刷新工作区、`⤢` 最大化、`✕` 关闭
- 四边/四角拖动可缩放，最小 720×460
- 设置：**DSH 设置页 → Code Space**，可改主题（跟随 DSH / One Dark Pro / 导入 VS Code 主题 JSON）、
  编辑器字体、终端字号，并导入图标主题
- 控制台：

```js
await __dsv.probe()   // 环境探针：origin / worker / 插槽尺寸 / 层级
__dsv.open(); __dsv.close(); __dsv.toggle()
__dsv.layout.resetGeometry()   // 窗口拖丢时复位
```

`__dsv.probe()` 会输出一份结构化结果，重点看：

| 字段 | 含义 |
|---|---|
| `location.origin` | 页面真实 origin（`http://127.0.0.1:<port>` 还是 `dsh-app://`） |
| `workers.sameOrigin` | 插件静态路由上的 Worker 能否创建（Monaco 语言服务的前提） |
| `workers.blob` | blob Worker 是否被 CSP 放行 |
| `layout.slot` | 插槽容器实际尺寸（决定入口面板能做多大） |
| `layout.bodyLayers` | body 上各浮层的 z-index（决定壳与 DSH 模态的层级） |
| `host` / `api` | 宿主半边是否挂上、会话工作目录能否解析 |

## 安全边界

插件能读写用户磁盘，所以：

- 路由只接受**本机回环 + 同源**请求；
- 工作区内的路径先 `realpath` 再做前缀判断，**只允许会话工作区之内**；
- 读上限 2 MiB，写入走「临时文件 + rename」，不会写坏原文件；
- 远程工作区：文件操作走 SFTP，路径映射限制在工作区的远端根目录内；
- **主题 / 图标导入**是唯一的例外：它会读你填的那一个 JSON（以及图标 JSON 同目录的 SVG），
  这是用户显式指定的路径，读到的内容只在浏览器里使用，不会写回磁盘。

## 开发

```powershell
npm install                    # esbuild + typescript + monaco + xterm + 图标素材
npm run build                  # 边界检查 → monaco → xterm → icons → client
npm run smoke                  # 产物冒烟（不启动 DSH）
npm run typecheck              # tsc --noEmit
node install.mjs               # 装进 desktop profile（可加 --profile <dir>）
```

改配置前建议先快照：

```powershell
node B:\Coding\workbench\dsh-float\profile-guard.mjs snapshot
```

发布流程见 [docs/PUBLISH.md](docs/PUBLISH.md)。

## 路线图

| 版本 | 内容 |
|---|---|
| 0.1 – 0.6 | 壳 / Monaco / 快速打开 / 草稿 / diff / Git 只读 / SSH 终端 |
| 0.7 – 0.9 | 本地 PowerShell 控制台、Git 写操作、远程工作区 SFTP |
| 0.10 – 0.16 | 内核与 feature 分层、One Dark 主题、Material 图标、主题与图标导入 |
| 0.17 – 0.19 | 编辑器字体设置、速览与浮钮、高对比描边、设置页重排 |
| **1.0.0** | 首个公开发布版（本文档） |
| 之后 | 全局内容搜索、远程 Git、编辑器细节设置（字号 / 换行 / 缩进）、TextMate 与 LSP（按需、带体积预算） |

## License

MIT
