# Vendored: dsh-remote-ssh host half

`lib/host/remote-ssh/index.js` is copied from **@zhangfengshun/dsh-remote-ssh 2.4.41**
(`lib/index.js`, MIT). It is kept here unchanged so Code Space can eventually be the
only plugin that needs to be installed.

- Upstream: https://github.com/ZhangFengshun/dsh-remote-ssh
- License: MIT (see `LICENSE` in this directory); copyright ZhangFengshun
- Copied: 2026-10-30

What we do with it:

- The host entry is mounted by default (opt out with `DSV_BUILTIN_REMOTE_SSH=0`), because the
  external plugin and this copy would otherwise register the same tools (`remote_ssh_*`) and
  the same `/remote-ssh/api` routes twice.
- The client UI of the upstream plugin is **not** copied; Code Space will talk to the
  same HTTP API from its own remote panel.

## Patches applied to the vendored file

1. **File-backed settings** (`createFileSettingsFace` plus an early return in the
   `ctx.inject(["settings"], ...)` callback when `ownEntryId(ctx, name)` is undefined):
   mounted as a child of `dsh-vscode-ide` there is no loader entry named
   `dsh-remote-ssh`, and DSH's settings API throws
   `No configurable plugin entry "dsh-remote-ssh"`. In that case connections and
   workspaces are stored in `~/.dsh/code-space-remote.json`. Upstream behaviour is
   unchanged when the plugin runs as its own loader entry.
2. **Cancellable pull** (`syncHandles` + `cancelSync` API): while a syncDown runs, its
   ssh/tar child processes stay in a per-workspace map so Code Space can terminate them; the
   normal failure path then discards the temporary directory and leaves the mirror untouched.
3. **Diagnostics**: the parent plugin logs mount progress to `~/.dsh/code-space-remote.log`.
4. **Shell wrapper is opt-in** (`DSV_REMOTE_SHELL_WRAPPER=1`): upstream unconditionally writes
   `dsh-remote-shell.js` / `.cmd` into `~/.dsh/remote-ssh` on startup for DSH's own integrated
   terminal. Code Space's terminal connects with ssh2 directly and nothing in this profile points
   DSH's terminal at that wrapper, so generation is skipped unless the env var is set. The
   directory still holds `writeback-mtimes.json` (write-back freshness state).

Dependencies required by the copied file (declared in the root `package.json` so the
module keeps resolving after the upstream plugin is uninstalled): `yaml`,
`@deepseek-ai/schemastery`, `@deepseek-ai/cosmokit`, `@standard-schema/spec`.

## How to test the switch (one restart)

1. Quit DSH completely (tray → 退出).
2. Uninstall / remove `@zhangfengshun/dsh-remote-ssh` from the profile (or disable it).
3. Start DSH with `DSV_BUILTIN_REMOTE_SSH=1`.
4. Check: `remote_ssh_profiles` tool exists, the remote APIs answer, and the tools work.
5. If anything fails, unset the variable and reinstall the upstream plugin.
