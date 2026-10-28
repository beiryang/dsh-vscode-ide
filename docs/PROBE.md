# Phase 0 探针清单

运行方式：打开 DSH → 左侧栏「IDE」→ 打开工作台（或 `Ctrl+Alt+I`）→ 浏览器控制台执行：

```js
const p = await __dsv.probe()
p            // 完整结构
```

每一项都对应一个会改变后续设计的「不可预知事实」。把结果填进下表，作为 Phase 1 的依据。

## 1. 页面 origin 与相对路径

| 检查 | 看什么 | 结论 |
|---|---|---|
| `location.origin` | `http://127.0.0.1:<port>` 还是 `dsh-app://app` | 待填 |
| `host.ok` | `/dsh-vscode-ide/health` 是否返回 true（证明相对路径 fetch 能到宿主） | 待填 |
| `api.ok` | `POST /api/info` 能否拿到 `cwd`（证明 JSON POST 也通） | 待填 |

> 若 `host.ok=false` 但插件已装：说明相对路径在自定义协议下没被转发。备选方案是从 `location.origin` 拼绝对地址，或让宿主把实际端口注入到页面。

## 2. Worker（决定 Monaco 语言服务怎么接）

| 检查 | 看什么 | 结论 |
|---|---|---|
| `workers.sameOrigin.ok` | 从 `/dsh-vscode-ide/assets/probe-worker.js` new Worker 是否成功 | 待填 |
| `workers.sameOrigin.error` | 若失败，是 CSP、协议不支持，还是 404 | 待填 |
| `workers.blob.ok` | blob Worker 是否可用 | 待填 |

> 三种结果对应三条路：
> - 都 OK → 直接用 Monaco 默认的 blob worker；
> - 仅 sameOrigin OK → 覆盖 `MonacoEnvironment.getWorker` 用 URL 版；
> - 都失败 → v0.1 走「无 worker」模式（高亮/折叠/多光标/查找/diff 仍然可用，只是没有 TS 智能提示）。

## 3. 层级（决定壳的 z-index）

| 检查 | 看什么 | 结论 |
|---|---|---|
| `layout.bodyLayers` | body 上浮层的 z-index 分布，DSH 模态是多少 | 待填 |
| 实际观感 | 打开一个 DSH 确认框（例如关闭未保存文件），壳是否在它下面 | 待填 |

## 4. 插槽容器

| 检查 | 看什么 | 结论 |
|---|---|---|
| `layout.slot` | 左侧栏启动页的实际宽高 | 待填 |
| 观感 | 启动页是否需要更紧凑的排版 | 待填 |

## 5. 主题变量

| 检查 | 看什么 | 结论 |
|---|---|---|
| `theme.dark` | 是否识别出深色模式 | 待填 |
| `theme.vars` | `--dsw-alias-bg-base` / `--dsw-alias-label-primary` / `--dsh-font-family-code` 是否都有值 | 待填 |

---

## 结论（运行后填写）

- 页面 origin：
- Worker 路线：
- 壳的 z-index：
- 插槽尺寸：
- 主题映射是否完整：
- 需要改的设计：
