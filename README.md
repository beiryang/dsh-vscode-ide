# dsh-vscode-ide

> A VS Code-like workbench for [DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh-desktop) — **Monaco editor core, an independent floating window, and opt-in feature modules**.

[中文文档](README.zh.md)

Not a VS Code port, and it does not load `.vsix` extensions. It brings the part of VS Code people use every day — multi-tab editing, find/replace, diff, quick open, command palette, themes — into DSH, keeps it in a window you can move anywhere, and adds features only when they earn their weight.

## Screenshots

![Workbench: file tree, Monaco editor and an SSH terminal in one floating window](docs/screenshots/workbench.png)

| | |
|---|---|
| ![File explorer following the session workspace](docs/screenshots/explorer.png) | ![Source control and command palette](docs/screenshots/palette.png) |
| ![Diff against HEAD](docs/screenshots/diff.png) | ![SSH terminal built on xterm.js](docs/screenshots/ssh.png) |

![Settings: theme, editor font, theme and icon import, diagnostics](docs/screenshots/settings.png)

## Why another editor plugin?

| | Layout | Editor | Extensibility | Package size |
|---|---|---|---|---|
| **dsh-vscode-ide** | Floating workbench, never squeezes the conversation | **Monaco** (same core as VS Code) | Built-in modules + public `ctx.vscodeIde` service | ~11 MB |
| `dsh-vscode-mode` | Docked in the right sidebar | Monaco | LSP + SVN + snippets + extension manager | ~27 MB |
| `dsh-ide` / `dsh-workbench` | Right sidebar | CodeMirror | File tree / Git review | 1–3 MB |
| dock family | Dock rail | CodeMirror | Six packages, install what you need | 0.1–1 MB each |

The trade-off: **keep the editing feel (Monaco), drop the weight (extension host / LSP / SVN)** — and never steal width from the conversation panel.

## Features (1.1)

- **Floating workbench** — drag, 8-way resize, maximize with a 44px top safety strip (so you can always reach DSH's own window buttons), geometry remembered
- **Peek mode** — `Ctrl+Alt+Q` hides the workbench so you can read the conversation, press again to return with editor state, scroll position and cursor intact; a draggable floating button does the same with the mouse
- **File explorer** — follows the active session's cwd, lazy directory loading; **remote workspaces go through SFTP**
  automatically. Right-click for new file/folder, rename, delete, copy path and “reveal in file manager”; drag rows
  onto folders (or the empty area for the workspace root) to move them, with edge auto-scroll and a live drop hint;
  `↑`/`↓`/`Enter`/`F2`/`Delete` drive it from the keyboard
- **Monaco editor** — pre-bundled ESM, loaded on demand; one `ITextModel` per file, so switching tabs never loses unsaved work
- **Tabs & breadcrumbs** — single click opens a preview tab (italic) that is replaced by the next one, double click
  pins it, drag to reorder, right-click to close others/to the right/saved; the breadcrumb bar above the editor
  lists siblings and drills into folders
- **Split editor** — “open in split pane” puts a second file on the right with its own tab row and breadcrumbs;
  both panes edit the same model, so changes and undo history stay in sync
- **Problems panel** — `Ctrl+Alt+Shift+M` or the titlebar `⚠` badge lists Monaco diagnostics grouped by file;
  the badge shows a live error/warning count and turns amber when there is something to fix
- **Status bar** — Git branch with ahead/behind, cursor position, language and line endings
- **Save / close** — `Ctrl+S` (temp file + atomic rename), `Ctrl+W`, dirty markers, close confirmation
- **Find & replace** — Monaco's built-in widget (`Ctrl+F`)
- **Quick open / command palette** — `Ctrl+Alt+P` and `Ctrl+Alt+Shift+P` (`Ctrl+P` belongs to DSH)
- **Content search & replace** — `Ctrl+Alt+Shift+F` opens a floating search panel: search the whole workspace, results grouped per file, click to jump to the line, `⇄` reveals the replace box for a confirmed replace-all, `⋯` adds include/exclude glob filters;
  `git grep` inside repositories, bounded filesystem walk elsewhere (local workspaces only for now)
- **Hot exit** — unsaved buffers are persisted to `localStorage: dsv:drafts.v1` and restored (with dirty markers) after a restart
- **Diff** — against disk, against `HEAD`, or between two files
- **Git** — VS Code-style Source Control (branch row, message box, collapsible staged/changes sections, per-file
  stage/unstage, colour-coded status letters), commit dropdown (staged / all / commit-and-push), discard, push, and a
  **commit graph** with lane lines, ref badges, per-commit file lists and a context menu (copy hash, checkout,
  create branch, revert). Works on remote workspaces too — the commands run on the server over SSH. If the workspace
  root is not a repo, “select repository folder…” lets you point Git at a subdirectory (local and remote)
- **SSH terminal** — xterm.js with a real PTY, multiple sessions. The panel sits **under the editor inside the editor
  column** (VS Code style, file tree keeps the full height): drag the divider to resize, drag all the way down to
  collapse it to a single strip and click/drag that strip to bring it back. A header button can dock it to the right
  side instead, `⫽` shows two sessions side by side, and the content area has a right-click menu (copy / paste /
  select all / clear / rename / close). Connection details are reused from `dsh-remote-ssh` when available; otherwise
  “＋SSH” lets you type host / user / key (or password) directly — first use needs no pre-configured remote workspace.
  With exactly one remembered host (or a remote workspace) “＋SSH” connects immediately; the chooser only appears when
  there are several or none. Passwords are never stored. SSH tabs are marked `远程`, and connecting from a local
  workspace shows a one-time reminder that commands run on the server while the workspace stays local
- **Local PowerShell** — a real ConPTY session (`@homebridge/node-pty-prebuilt-multiarch`), so `vim`, `top`, colours
  and Tab completion behave like a normal terminal
- **Themes** — follow DSH, built-in One Dark Pro, or **import any VS Code theme JSON** (editor and shell change together)
- **Icons** — built-in Material Icon Theme, or **import any VS Code icon theme** (sprites are generated at build time and lazily loaded)
- **Settings** — editor font / size, word wrap, line numbers, tab width, **terminal font family and size**,
  theme/icon import, host diagnostics; all persisted and applied without reopening tabs
- **Environment probe** — `await __dsv.probe()` (`probe(true)` writes the result to a file)

## Install

> npm publishing is pending (region-restricted signup). Until then use the GitHub release package.

### From GitHub Releases

1. Download `dsh-vscode-ide-1.0.0.tgz` from [Releases](https://github.com/beiryang/dsh-vscode-ide/releases)
2. Extract it and run the bundled installer:

```powershell
tar -xzf dsh-vscode-ide-1.0.0.tgz
cd package
node install.mjs
```

`install.mjs` detects the profile that already contains this plugin and falls back to the default desktop profile;
pass `--profile "<dir>"` to target an explicit profile directory.

3. **Fully quit DSH** (tray icon → Quit) and start it again — the client bundle is loaded only at startup.

### From source (development)

```powershell
npm install
npm run build                     # required: vendor/ and lib/client.js are not committed
node install.mjs
```

### npm (once published)

```sh
dsh plugin --profile web add dsh-vscode-ide
```

### Uninstall

```powershell
node install.mjs --remove
```

Removing the plugin keeps its `localStorage` data (window geometry, theme, tabs).

## Usage

- Click **Code Space** in the left sidebar to open/close the workbench (works even if the window was dragged off-screen)
- `Ctrl+Alt+I` toggles the workbench; `Ctrl+Alt+Q` peeks at the conversation; `Ctrl+Alt+Shift+F` opens content search
- Floating button: same as `Ctrl+Alt+Q`, draggable, position remembered
- Title bar: `⌕` quick open, `>` command palette, `↻` refresh workspace, `–` minimize to the conversation
  (same as `Ctrl+Alt+Q`), `⤢` maximize, `✕` close
- Settings live in **DSH Settings → Code Space**

Console helpers:

```js
await __dsv.probe()       // environment probe
__dsv.open(); __dsv.close(); __dsv.toggle()
__dsv.layout.resetGeometry()
```

## Architecture

Three layers with an enforced boundary — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md):

```
kernel/    Workbench kernel: window shell, layout, palette, registry, themes
           (must not import any feature — checked by scripts/check-boundary.mjs)
features/  Feature modules: editor / explorer / git / terminal
           (each ships its own views, commands and styles)
dsh/       DSH slot adapters: sidebar entry, settings section
```

Third-party code can extend the workbench through the public service `ctx.vscodeIde` (contract v1):

```ts
ctx.vscodeIde.registerView({ apiVersion: 1, id, title, region: 'sidebar' | 'main' | 'panel', order, component })
ctx.vscodeIde.registerStatusItem({ apiVersion: 1, id, order, render })
ctx.vscodeIde.registerCommand({ id, title, run })
ctx.vscodeIde.openFile(path)
```

Contributions carrying an unknown `apiVersion` are ignored with a warning instead of breaking the workbench.

| Item | Value |
|---|---|
| HTTP prefix | `/dsh-vscode-ide/*` |
| Storage | `localStorage: dsv:*` |
| CSS | `--dsv-*` / `.dsv-*` |
| Service | `ctx.vscodeIde` |

## Security

The plugin can read and write files on your machine, therefore:

- HTTP routes accept loopback + same-origin requests only
- Workspace paths are `realpath`-checked and must stay inside the session workspace
- 2 MiB read limit; writes go through temp-file + rename
- Remote workspaces: file access goes over SFTP and is mapped inside the workspace's remote root
- **Theme / icon import** is the single exception: it reads exactly the JSON path you type (plus the SVGs referenced from that JSON's directory) and never writes anything back

## Development

```powershell
npm install          # esbuild, typescript, monaco, xterm, icon assets
npm run build        # boundary check → monaco → xterm → icons → client bundle
npm run smoke        # loads the bundle in Node and asserts apply/inject
npm run typecheck    # tsc --noEmit
node install.mjs     # install into the desktop profile
```

Publishing checklist: [docs/PUBLISH.md](docs/PUBLISH.md). Third-party licenses: [THIRD-PARTY.md](THIRD-PARTY.md).

## License

MIT
