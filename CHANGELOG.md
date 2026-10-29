# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/); versions are semver.

## 1.1.1

### Fixed

- Search shortcut moved to `Ctrl+Alt+Shift+F`: `Ctrl+Alt+F` is DSH's “copy session”
- Added a `搜` button in the title bar as a mouse entry point for content search

## 1.1.0

### Added

- **Content search** (`Ctrl+Alt+Shift+F`, sidebar “搜索” view, or the `搜` button in the title bar): search the whole workspace, results grouped by file
  with line numbers, click to jump to the line; `Aa` / `ab` / `.*` toggles for case sensitivity, whole word and regex
- Host uses `git grep` inside Git repositories (fast, skips binaries) and falls back to a bounded filesystem walk
  elsewhere (skips `node_modules`/`.git`/build dirs, binary files and files over 1 MB; 500 result cap)
- Remote (SFTP) workspaces report a clear “not supported yet” message instead of hanging

### Changed

- `openFile` accepts an optional `line`, so any feature (search, future problem matchers) can jump to a position

## 1.0.0 — first public release

The first release that is meant to be installed by people other than the author.

### Workbench shell

- Independent floating window mounted on `document.body`; DSH slots are used only for the entry points
- Drag, 8-way resize, maximize, geometry persisted in `localStorage: dsv:layout.v1`
- Maximize keeps a 44px strip at the top so DSH's own title bar and window buttons stay reachable
- Left sidebar entry **Code Space** toggles the window (a reliable way out when the window is off-screen)
- **Peek** (`Ctrl+Alt+Q`) hides the window without unmounting it, so editor models, scroll and cursor survive
- Draggable floating button as a mouse equivalent of peek; position persisted
- High-contrast window outline and floating button (visible on dark backgrounds)

### Editor

- Monaco 0.53, pre-bundled as ESM and loaded on demand (workers served from the plugin host)
- One `ITextModel` per file; tabs keep undo stack, cursor and unsaved content
- Save via temp file + atomic rename, dirty markers, close confirmation
- Hot exit: unsaved buffers persisted to `localStorage: dsv:drafts.v1`, restored after restart
- Find & replace, quick open (`Ctrl+Alt+P`), command palette (`Ctrl+Alt+Shift+P`)
- Diff views: against disk, against `HEAD`, or between two files
- Editor font family is configurable (defaults to Maple Mono NF CN Light, with a migration from the old mixed CJK stack)

### Explorer

- Lazy-loading file tree bound to the active session workspace
- Remote workspaces automatically switch to **SFTP** (path mapping local mirror ↔ remote root)
- Material Icon Theme sprites built at build time and lazily fetched; user icon themes can be imported

### Git

- Branch, ahead/behind, change list with staged/unstaged groups
- Per-file stage/unstage, stage all, commit, push (auto `-u origin <branch>` when no upstream is configured)

### Terminals

- SSH terminal over `ssh2` (vendored pure-JS dependencies), NDJSON over HTTP streaming instead of WebSocket
- Multiple sessions, resizable bottom panel, connection metadata reused from `dsh-remote-ssh`
- Local PowerShell console (pipe based, not a PTY): output pane + input line, ↑↓ history, `Ctrl+L` clear
- Terminal font size setting (10–20px), applied to open terminals immediately

### Theming

- One theme object drives both the editor (`rules` + `colors`) and the shell (`--dsv-*` variables)
- Built-in: follow DSH, One Dark Pro
- Import any VS Code theme JSON from a local path (host reads the file, validation + colour filtering)

### Kernel / extensibility

- `kernel/` + `features/` + `dsh/` layering with an enforced import boundary (`scripts/check-boundary.mjs`)
- Public contract `ctx.vscodeIde` (views, status items, commands, open file) with `apiVersion` negotiation
- Command palette, settings section, environment probe (`__dsv.probe()`)

### Known limits

- Local console is not a PTY: full-screen programs (`vim`, `top`, `htop`) don't work
- Git panel works on local workspaces only; remote workspaces show a notice
- No content search yet (file-name quick open only)
- No `.vsix` / extension host / LSP / TextMate grammars

## 0.17.0 – 0.19.0

- Editor font setting with candidate list and instant apply
- Peek mode and floating toggle button
- Window outline and floating button reworked for dark backgrounds
- Settings page rebuilt into grouped cards (appearance / extensions / diagnostics)

## 0.10.0 – 0.16.0

- Kernel extraction: `kernel/` no longer imports any feature; styles and commands moved into features
- One Dark Pro theme (editor + shell) and theme import
- Material Icon Theme sprite pipeline and icon theme import
- Remote workspace file access moved to SFTP
- Local PowerShell console with UTF-8 safe transport (base64 command envelope)

## 0.1.0 – 0.9.0

- Floating shell, sidebar entry and settings section
- File tree, Monaco editor, tabs, save, find/replace
- Quick open, command palette, drafts (hot exit), diff
- Git read-only, then stage/unstage/commit/push
- SSH terminal (xterm.js) with vendored `ssh2`
