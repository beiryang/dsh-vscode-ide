# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/); versions are semver.

Per-release cadence: feature work lands on `main` without version bumps; the version and the git tag are created
only when a release is actually published. Intermediate iterations are collapsed into the release they belong to.

Version format: `MAJOR.MINOR.PATCH` where **PATCH starts at 10** (10, 11, 12 … 99) and always has two digits.
When patch reaches 99 the minor is bumped and patch restarts at 10 (`1.1.99` → `1.2.10`).

## 1.1.10 — unreleased

### Added

- **Content search** as a floating panel (`Ctrl+Alt+Shift+F`, or “在文件中搜索” in the command palette):
  whole-workspace search, results grouped per file with line numbers, click to jump to the line,
  `Aa` / `ab` / `.*` toggles for case sensitivity, whole word and regex; closed with `Esc` or a click outside
- Host search engine: `git grep` inside Git repositories, bounded filesystem walk elsewhere
  (skips `node_modules`/`.git`/build dirs, binary files and files over 1 MB; 500-result cap)
- Remote (SFTP) workspaces report a clear “not supported yet” message instead of hanging
- Editor appearance settings, applied live without reopening tabs: font size (10–24 px), word wrap,
  line numbers, tab width (1–8)
- Kernel API `registerOverlay` for global floating layers that follow the window's lifetime
- **Manual SSH connections**: the “＋SSH” button opens a dialog for host / port / user / key path (or password),
  so the terminal works on first install without a pre-configured `dsh-remote-ssh` workspace.
  Saved hosts live in `localStorage: dsv:ssh.hosts.v1` (no passwords); missing key paths fall back to
  `~/.ssh/id_ed25519`, `id_ecdsa`, `id_rsa`
- Source Control panel restyled after VS Code: branch row with sync/refresh icons, message box with a full-width
  commit button, collapsible “已暂存的更改 / 更改” sections with counts, colour-coded status letters, dim directory
  paths and per-row stage/unstage actions
- Smart “＋SSH”: connects straight away when the session is a remote workspace or exactly one host is remembered;
  the dialog (host list + form) only appears when there are several hosts or none. The `▾` button always opens it
- Source Control context menu: open diff, stage/unstage, **discard changes** (restores tracked files and deletes
  untracked ones behind a confirmation), copy relative path — backed by a new `git/discard` host route
- Commit dropdown: commit staged / commit all (stage everything first) / commit and push
- Sidebar view tabs can carry an icon; Explorer (`▤`) and Source Control (`⎇`) now show one
- Window: **minimize button in the title bar** (same behaviour as peek — hides the window, `Ctrl+Alt+Q` returns).
  The status-bar “✕ 关闭” button was removed; closing stays available via the title-bar ✕, `Esc`, and the
  sidebar launcher
- **Replace all** in the search panel (`⇄` toggles the replace box, confirmation shows the match/file counts);
  backing host route `replace/content` reuses the search index and writes each file atomically
- **Remote Git**: on SFTP workspaces the Git panel now works — `status / log / show / stage / unstage /
  commit / push / discard` run on the server over the existing SSH connection (`lib/host/remote-git.js`),
  paths are mapped back to the local mirror so diffs still open in Monaco

### Fixed

- Source Control now shows the real reason (including the remote case) instead of a generic
  “当前工作区不是 Git 仓库”, and offers a hint on how to fix it

### Changed

- `openFile` accepts an optional `line`, so any feature can jump to a position
- Monaco indentation detection is disabled so the configured tab width actually takes effect

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
