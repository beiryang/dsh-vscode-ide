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
- Graph now draws **connection lanes** (SVG): each active branch is a coloured vertical line, commits sit on their
  lane, so merges/parallel branches read as connected lines. Removed the per-row separator lines and the boxed
  expand arrow (plain small caret); hover info card and click-to-expand behaviour stay
- Source Control **file type icons** (shared Material sprite) in change rows, and a **Graph section**: recent commits
  with author, relative time, and ref badges for the current branch, remotes and tags, plus refresh / fetch / pull /
  push buttons. `git/pull` and `git/fetch` are new host routes (local and remote). The Graph area has a draggable
  top edge (double-click resets to 220px) and its height is remembered in `localStorage: dsv:git.graph.v1`.
  Hovering a commit shows a fixed info card (author, relative time, subject, hash, ref badges); clicking a commit
  expands its changed files, and clicking a file opens the commit's before/after diff in Monaco
  (new `git/commit-info` and `git/commit-file` routes, local and remote)
- Source Control context menu: open diff, stage/unstage, **discard changes** (restores tracked files and deletes
  untracked ones behind a confirmation), copy relative path — backed by a new `git/discard` host route
- Commit dropdown: commit staged / commit all (stage everything first) / commit and push
- Sidebar view tabs can carry an icon; Explorer (`▤`) and Source Control (`⎇`) now show one
- Window: **minimize button in the title bar** (same behaviour as peek — hides the window, `Ctrl+Alt+Q` returns).
  The status-bar “✕ 关闭” button was removed; closing stays available via the title-bar ✕, `Esc`, and the
  sidebar launcher
- **Terminal panel position**: the panel now sits **under the editor inside the editor column** (VS Code style — the
  file tree keeps full height). Drag the divider to resize; drag it all the way down and the panel snaps to a single
  thin strip of ~10px (header included), which can be clicked, double-clicked or dragged back up; Dragging up is capped by the
  editor column height, so the terminal can cover the whole column and the editor shrinks to a strip. A header button
  switches to a right-side dock when preferred; height and width are remembered per dock
- **Replace all** in the search panel (`⇄` toggles the replace box, confirmation shows the match/file counts);
  backing host route `replace/content` reuses the search index and writes each file atomically
- **Per-workspace Git root**: the branch row now has a `⋯` menu (“change repository folder…” / “clear selection,
  back to the workspace root”) so a chosen folder can always be changed or removed afterwards
- **Per-workspace Git root** (initial): when the workspace root is not a repository, “选择仓库目录…” scans for `.git`
  folders (depth ≤ 3) and lets you pick one, or type a relative path; the choice is remembered per workspace in
  `localStorage: dsv:git.root.v1`. Works for local and remote workspaces (remote scan uses `find` over SSH)
- **Remote Git**: on SFTP workspaces the Git panel now works — `status / log / show / stage / unstage /
  commit / push / discard` run on the server over the existing SSH connection (`lib/host/remote-git.js`),
  paths are mapped back to the local mirror so diffs still open in Monaco

- **Terminal right-click menu** — copy (selection), paste, select all, clear (sends `Ctrl+L` so the shell really clears),
  rename session, close session; the menu follows the cursor and acts on the terminal under the pointer
- **Path-aware search filters** — the search panel's `⋯` row takes include / exclude globs (e.g. `src/**/*.ts`,
  `**/*.min.js`), applied to both the `git grep` and filesystem-walk backends
- **Editor tabs** — preview tabs (italic) replaced on single click, pinned on double click, drag to reorder,
  right-click menu: close / close others / close to the right / close saved; `workspace.moveTab` etc.
- **Breadcrumbs** above the editor — every segment is clickable: a directory opens its sibling list (and can be
  drilled into) and the file segment reopens the file; the split pane has its own breadcrumb bar
- **Status bar** — Git branch with `↑ahead ↓behind`, `Ln x, Col y`, language id and line endings, alongside the
  existing session / version chips
- **Explorer file operations** — right-click menu: new file / new folder / rename / delete (with confirmation) /
  copy path / reveal in OS; backed by `fs/create|delete|rename|reveal` host routes (local only)
- **Drag to move in the explorer** — drop a file or folder onto any row (that row's directory) or the empty area
  (workspace root); self/descendant and overwrite moves are rejected, the tree auto-scrolls near its edges via
  `requestAnimationFrame`, and a cursor-following chip plus row outline show the destination
- **Explorer keyboard navigation** — `↑`/`↓` move the selection through visible rows, `Enter` opens a file or
  toggles a folder, `F2` renames, `Delete` deletes; the selected row is highlighted
- **Problems panel** — `Ctrl+Alt+Shift+M` (or the titlebar `⚠` badge) opens a floating list of Monaco diagnostics
  grouped by file with severity icons and line/column; clicking an entry jumps to it. The badge shows the live
  error/warning count, turns amber when non-zero and stays subdued otherwise
- **Split editor** — “open in split pane” in the explorer context menu shows a second file on the right; both
  panes share the same `ITextModel` (edits and undo history stay in sync), the right pane has its own tab row,
  breadcrumb bar and close button
- **Split terminal** — `⫽` splits the terminal panel into two side-by-side sessions (the right one is cycled with
  another click, `⫽✕` closes it); terminals are not re-created, so buffers and running commands survive
- **SSH session safety hints** — SSH tabs carry a `远程` badge, and opening an SSH terminal from a **local**
  workspace shows a one-time banner explaining that commands run on the remote host while the workspace stays local
  (the workspace kind is re-probed on every session change and every 1.5s, so switching workspaces updates it)
- **Terminal font family** setting (defaults to Maple Mono NF CN with Nerd Font fallbacks), applied live to open
  and new terminals
- **Git graph / commit actions** — branch tooltip shows ahead/behind; commits have a context menu (copy short and
  full hash, checkout, create branch, revert), backed by `git/checkout|branch|revert` routes for local and remote
  workspaces

### Fixed

- Source Control now shows the real reason (including the remote case) instead of a generic
  “当前工作区不是 Git 仓库”, and offers a hint on how to fix it
- **React #310 (“Rendered more hooks than during the previous render”)** could blank the workbench: the sidebar
  width hook sat after the window's early return, and the terminal panel's context-menu effect sat after its own
  early return; both moved above the returns. Every view is also wrapped in a small error boundary, so a broken
  panel shows a red message and a retry button instead of taking the whole window down
- Breadcrumb directory segments did nothing on click (the menu was closed before reading the previous state)
- Terminal right-click menu looked like a row of default buttons pinned under the panel: a missing `}` in
  `styles.ts` made the CSS parser swallow all following rules, including the menu's `position: fixed`
- The titlebar `⚠` badge was not amber and its count wrapped to a second line: a generic
  `.dsv-titlebar-actions button` rule won on specificity, and the button was fixed-width
- `Esc` closed the whole workbench even when an overlay was open; overlays/dialogs now consume it first, and
  the “escape hatch” only closes the window when nothing else is showing
- Keyboard shortcuts are dispatched explicitly in `app.tsx`, so the problems panel needed its own branch
  (registering `keybinding` alone does not bind anything)
- Split editor: the second Monaco instance was created while its container had zero height (blank, uneditable);
  it now waits for a real size, and the pane was moved to its own column so its tab row lines up with the left one
- Opening a file that only existed as a model (created by the split pane) changed the content but left the old tab
  title and breadcrumbs; such files now get a tab before activation
- Terminal “clear” used xterm's viewport clear and was immediately repainted by the shell; it now sends `Ctrl+L`

### Changed

- **Dark-theme contrast pass**: brighter shell text palette (`fg` / `fgDim` / `fgFaint` in One Dark), no more
  low-opacity metadata text, brighter placeholders, directory paths and counts in the Git panel, tab labels,
  panel titles and search hints — matching VS Code’s readability on dark backgrounds

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
