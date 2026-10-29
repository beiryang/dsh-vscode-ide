# 发布清单

首次发布（以及后续每次发布）照着走一遍，避免漏项。

## 版本节奏（重要）

原则：**版本号是发布动作的一部分，不是开发动作的一部分。**

| 场景 | 做什么 |
|---|---|
| 开发一个新功能 / 修一个 bug | 只提交到 `main`，**不动 `package.json` 的 version，不打 tag** |
| 攒够一批要交付的改动 | 发布前一次性定版本号（新功能 → minor；纯修复 → patch；破坏性 → major），补 CHANGELOG 段落 |
| 真正发布（npm publish / GitHub Release） | 打 tag → 推 tag → 传包，**一个版本只有一个 tag** |

### 版本号格式

`MAJOR.MINOR.PATCH`，其中 **PATCH 从 10 开始、固定两位数**：

```
1.1.10   第一个 1.1 版本
1.1.11   第二个 1.1 版本
...
1.1.99   最后一个个位区间
1.2.10   次版本递增，patch 重新从 10 开始
```

注意：`1.1.01` 这种带前导零的写法**不是合法 semver**，npm 会拒绝发布（`Invalid version`）。
所以两位数靠"从 10 起"实现，而不是靠补零。

不要做的事：

- 每修一个小问题就 `1.1.10 → 1.1.11 → 1.1.12`（版本号会被噪音淹没，用户也看不出差别）
- 先打 tag、后补 CHANGELOG（tag 和内容不一致）
- 为 README 文案变化单独发一个版本（能合进下一个版本就合）

## 0. 发布前检查

```powershell
cd B:\Coding\workbench\dsh-vscode-ide

npm run typecheck        # tsc 无错
npm run build            # 边界检查 → monaco → xterm → icons → client
npm run smoke            # bundle 能被加载、apply/inject 都在
node -e "console.log(require('./package.json').version)"
```

- [ ] `CHANGELOG.md` 顶部加好本次版本段落
- [ ] `README.md` / `README.zh.md` 的功能清单没有过期
- [ ] `THIRD-PARTY.md` 覆盖所有随包分发的第三方资源
- [ ] 版本号语义正确（破坏性变更 → major；新功能 → minor；修复 → patch）

## 1. 打包自检

```powershell
npm pack --dry-run
```

确认三件事：

- 只有 `lib/ vendor/ docs/ cordis.patch.yml README* CHANGELOG.md THIRD-PARTY.md LICENSE` 进包
- `src/`、`scripts/`、`node_modules/`、测试文件**没有**被打进去
- 体积合理（Monaco + xterm + 图标 sprite + ssh2 ≈ 14 MB；如果突然大很多，检查有没有误打包 `src`）

真实打一次包并解压检查：

```powershell
npm pack
tar -xzf dsh-vscode-ide-<version>.tgz
node -e "import('./package/lib/index.js').then(m => console.log('exports:', Object.keys(m)))"
```

- [ ] 解压后的 `lib/index.js` 能被 Node 正常 import
- [ ] `lib/client.js` 存在且非空
- [ ] `vendor/monaco/esm/monaco.js`、`vendor/xterm/xterm.js`、`vendor/icons/icons.js` 都在

## 2. 本地实装验证

```powershell
node install.mjs
```

托盘退出 DSH → 重开 → 冒烟走查：

- [ ] 左侧栏 Code Space 能开关工作台
- [ ] 打开文件、改一行、`Ctrl+S` 保存成功
- [ ] `Ctrl+Alt+Q` 速览能来回切且光标不丢
- [ ] 设置页 Code Space 分区能改主题 / 字体 / 终端字号
- [ ] 终端能连上（远程工作区）
- [ ] `await __dsv.probe()` 返回结构正常

## 3. 发布到 npm

```powershell
npm login                    # 只需一次
npm whoami                   # 确认身份
npm publish --access public  # 包名非 scoped 时 --access public 可省
```

- [ ] `npm view dsh-vscode-ide version` 返回新版本
- [ ] 在干净目录里 `npm i dsh-vscode-ide` 后能 import 到 `lib/index.js`

## 4. GitHub 仓库

- [ ] 新建仓库 `dsh-vscode-ide`，推上去（`main` 分支）
- [ ] 仓库 About 填一句话描述 + 加 topic：`dsh-plugin`、`deepseek-harness`、`monaco`、`ide`
- [ ] Release 打 tag `v<version>`，正文直接用 CHANGELOG 对应段落
- [ ] 把仓库地址回填到 `package.json` 的 `repository` / `homepage` / `bugs`，并重新发一版 patch

## 5. 市场 / 生态

- [ ] 在 DSH 插件市场提交条目（名称、描述、截图、仓库地址）
- [ ] 截图建议三张：工作台全景、diff 视图、设置页
- [ ] 描述里明确边界：Monaco 内核的轻量工作台，不是 VS Code 移植，不加载 `.vsix`

## 6. 发布后

- [ ] 打 tag 并同步 README 徽章（版本 / license）
- [ ] 记一条 memory：本次版本号、发布渠道、遗留问题
- [ ] 观察第一批 issue，优先修「装不上 / 打不开 / 关不掉」三类问题

## 回滚

- npm 不能删除已发布版本（72 小时后），只能 `npm deprecate` 并发布新补丁版
- 因此**发布前**的 `npm pack --dry-run` 和本地实装两步绝不能省

## 备选渠道：npm 不可用时（注册受限 / 网络封锁）

`npm publish` 不是唯一出路。包本身已经自带安装器，可以直接用 GitHub Release 分发：

1. 打 tarball（不需要 npm 账号）：

```powershell
npm pack        # 产出 dsh-vscode-ide-<version>.tgz
```

2. 在 GitHub Release 里把它作为附件上传（和源码 zip 并列）
3. 用户安装：

```powershell
# 解压后进目录
tar -xzf dsh-vscode-ide-1.0.0.tgz
cd package
node install.mjs --profile "A:\Users\Liu\.dsh\profiles\desktop"
```

（`install.mjs` 已包含在发布包里，所以解压即可安装，不依赖本仓库。）

4. DSH 插件市场列表：通常要求 npm 包，这一步要等账号可注册后再补；在此之前 README 里说明「GitHub Release 安装」方式即可。

注意：

- 升级/卸载仍用同一个 `install.mjs`（`--remove` 卸载，保留 `localStorage` 用户数据）
- GitHub Release 附件没有 npm 的版本解析，**升级要手动重下一次**；所以一旦 npm 可用，应尽快切回 npm 主渠道
