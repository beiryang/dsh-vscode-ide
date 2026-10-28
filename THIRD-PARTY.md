# 第三方资源与许可

本插件自身以 MIT 许可发布（见 `LICENSE`）。随包分发的第三方资源如下，均为 MIT 许可，
已按其要求保留出处：

| 资源 | 用途 | 许可 | 来源 |
|---|---|---|---|
| **Monaco Editor** | 编辑器内核（`vendor/monaco/`） | MIT | https://github.com/microsoft/monaco-editor |
| **xterm.js** | 终端渲染（`vendor/xterm/`） | MIT | https://github.com/xtermjs/xterm.js |
| **ssh2** + 依赖（asn1 / bcrypt-pbkdf / tweetnacl / safer-buffer） | SSH 终端（`vendor/node_modules/`） | MIT | https://github.com/mscdex/ssh2 |
| **Material Icon Theme** | 文件/文件夹图标（`vendor/icons/`，构建期由 `scripts/build-icons.mjs` 合成） | MIT | https://github.com/material-extensions/vscode-material-icon-theme |

## 关于主题

工作台内置的 **One Dark Pro** 主题配色是按 One Dark 的公开调色板**重新实现**的（颜色值、
高亮规则都由本插件自己编写），没有打包 One Dark Pro 的原文件。

## 关于图标

图标资源在构建期从 `material-icon-theme` 的 SVG 合成一张 sprite（1131 个符号），
运行时不依赖该 npm 包，也不联网。若需重新生成：

```bash
npm install            # 含 material-icon-theme（devDependency）
node scripts/build-icons.mjs
```
