/** 源代码管理样式（VS Code 风格）：分支条、提交区、分组、变更行。 */

export const CSS = `
/* ── 分支条 ── */
.dsv-scm-branch {
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 8px 0 10px;
  border-bottom: 1px solid var(--dsv-border-soft);
  font-size: 11px;
}

.dsv-scm-branch-name {
  font-family: var(--dsv-mono, monospace);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsv-scm-sync { color: var(--dsv-fg-dim); font-size: 10px; }

.dsv-scm-root {
  color: var(--dsv-fg-dim);
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsv-scm-spacer { flex: 1; }

.dsv-scm-more {
  position: absolute;
  right: 6px;
  top: 28px;
  z-index: 40;
}

.dsv-scm-icon-btn {
  flex: none;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--dsv-fg-dim);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}

.dsv-scm-icon-btn:hover:not(:disabled) { background: var(--dsv-hover); color: var(--dsv-fg); }
.dsv-scm-icon-btn:disabled { opacity: 0.3; cursor: default; }

/* ── 提交区 ── */
.dsv-scm-commit {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid var(--dsv-border-soft);
}

.dsv-scm-message {
  width: 100%;
  box-sizing: border-box;
  min-height: 46px;
  padding: 6px 8px;
  border: 1px solid var(--dsv-border);
  border-radius: 4px;
  background: var(--dsv-input, var(--dsv-bg));
  color: var(--dsv-fg);
  font: inherit;
  font-size: 12px;
  outline: none;
  resize: vertical;
}

.dsv-scm-message:focus { border-color: var(--dsv-accent); }
.dsv-scm-message::placeholder { color: var(--dsv-fg-dim); opacity: 0.9; }

.dsv-scm-commit-row { display: flex; gap: 4px; }

.dsv-scm-commit-caret {
  flex: none;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--dsv-border);
  border-radius: 4px;
  background: transparent;
  color: var(--dsv-fg-dim);
  font-size: 10px;
  cursor: pointer;
}

.dsv-scm-commit-caret:hover:not(:disabled) { background: var(--dsv-hover); color: var(--dsv-fg); }
.dsv-scm-commit-caret:disabled { opacity: 0.4; cursor: default; }

.dsv-scm-dropdown {
  display: flex;
  flex-direction: column;
  padding: 4px;
  border: 1px solid var(--dsv-border);
  border-radius: 6px;
  background: var(--dsv-panel);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
}

.dsv-scm-dropdown button {
  height: 24px;
  padding: 0 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}

.dsv-scm-dropdown button:hover:not(:disabled) { background: var(--dsv-hover); }
.dsv-scm-dropdown button:disabled { opacity: 0.4; cursor: default; }

.dsv-scm-commit-btn {
  flex: 1;
  height: 26px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: var(--dsv-accent);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.dsv-scm-commit-btn:disabled {
  background: var(--dsv-panel-alt);
  color: var(--dsv-fg-dim);
  cursor: default;
}

.dsv-scm-note {
  font-size: 11px;
  color: var(--dsv-fg-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 分组标题 ── */
.dsv-scm-list { padding-bottom: 8px; }

.dsv-scm-section-head {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px 0 4px;
  margin-top: 2px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.dsv-scm-section-toggle {
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--dsv-fg-dim);
  font-size: 10px;
  cursor: pointer;
}

.dsv-scm-section-title { cursor: pointer; }

.dsv-scm-count {
  min-width: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--dsv-hover, rgba(127, 127, 127, 0.18));
  color: var(--dsv-fg);
  font-size: 10px;
  font-weight: 400;
  text-align: center;
}

.dsv-scm-section-action {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--dsv-fg-dim);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.7;
}

.dsv-scm-section-action:hover:not(:disabled) { background: var(--dsv-hover); color: var(--dsv-fg); opacity: 1; }
.dsv-scm-section-action:disabled { opacity: 0.25; cursor: default; }

/* ── 变更行 ── */
.dsv-scm-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 6px 0 18px;
  cursor: pointer;
  font-size: 12px;
}

.dsv-scm-row:hover { background: var(--dsv-hover, rgba(127, 127, 127, 0.14)); }

.dsv-scm-status {
  flex: none;
  width: 12px;
  text-align: center;
  font-family: var(--dsv-mono, monospace);
  font-size: 10px;
  font-weight: 700;
  color: var(--dsv-fg-dim);
}

.dsv-scm-status[data-code="M"] { color: #e2c08d; }
.dsv-scm-status[data-code="A"], .dsv-scm-status[data-code="U"], .dsv-scm-status[data-code="?"] { color: #73c991; }
.dsv-scm-status[data-code="D"] { color: #e06c75; }
.dsv-scm-status[data-code="R"], .dsv-scm-status[data-code="C"] { color: #4fc1ff; }

.dsv-scm-name {
  flex: none;
  max-width: 62%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsv-scm-dir {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsv-fg-dim);
  font-size: 11px;
}

.dsv-scm-row-action {
  flex: none;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--dsv-fg-dim);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  /* 常驻但很淡：纯悬停才出现的话，用户找不到这个按钮 */
  opacity: 0.4;
}

.dsv-scm-row:hover .dsv-scm-row-action { opacity: 0.95; }
.dsv-scm-row-action:hover:not(:disabled) { background: var(--dsv-hover); color: var(--dsv-fg); }
.dsv-scm-row-action:disabled { opacity: 0.2; cursor: default; }

/* ── 右键菜单 ── */
.dsv-scm-menu {
  position: fixed;
  z-index: 1200;
  min-width: 150px;
  display: flex;
  flex-direction: column;
  padding: 4px;
  border: 1px solid var(--dsv-border);
  border-radius: 6px;
  background: var(--dsv-panel);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.4);
}

.dsv-scm-menu button {
  height: 24px;
  padding: 0 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}

.dsv-scm-menu button:hover { background: var(--dsv-hover); }

/* ── 提交行图标 ── */
.dsv-scm-row .dsv-file-icon {
  width: 15px;
  height: 15px;
  flex: none;
  margin-right: 2px;
}

/* ── Graph 区块 ── */
.dsv-scm-graph-resize {
  flex: none;
  height: 9px;
  touch-action: none;
  user-select: none;
  margin-top: 2px;
  border-top: 1px solid var(--dsv-border-soft, var(--dsv-border));
  cursor: ns-resize;
}

.dsv-scm-graph-resize:hover {
  border-top-color: var(--dsv-accent);
  background: color-mix(in srgb, var(--dsv-accent) 12%, transparent);
}

.dsv-scm-graph {
  flex: none;
  overflow: auto;
  padding-bottom: 6px;
}

.dsv-scm-graph-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 8px 0 18px;
  font-size: 12px;
}

.dsv-scm-graph-row:hover { background: var(--dsv-hover, rgba(127, 127, 127, 0.14)); }

.dsv-scm-graph-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dsv-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsv-accent) 25%, transparent);
}

.dsv-scm-graph-subject {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsv-scm-graph-author {
  flex: none;
  font-size: 11px;
  color: var(--dsv-fg-dim);
}

.dsv-scm-ref {
  flex: none;
  height: 16px;
  line-height: 16px;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 10px;
  white-space: nowrap;
}

.dsv-scm-ref[data-kind="branch"] { background: #2f6fb3; color: #fff; }
.dsv-scm-ref[data-kind="remote"] { background: rgba(168, 120, 220, 0.35); color: #e6dcff; }
.dsv-scm-ref[data-kind="tag"] { background: rgba(215, 186, 125, 0.3); color: #f0dfb4; }
.dsv-scm-ref[data-kind="ref"] { background: var(--dsv-hover); color: var(--dsv-fg-dim); }

/* ── 提交行交互与悬停卡 ── */
.dsv-scm-graph-row { cursor: pointer; }

.dsv-scm-graph-row[data-active="true"] { background: var(--dsv-hover, rgba(127, 127, 127, 0.16)); }

.dsv-scm-commit-caret { flex: none; font-size: 9px; color: var(--dsv-fg-dim); margin-left: 2px; }

.dsv-scm-commit-files {
  padding: 2px 0 4px 26px;
  border-left: 1px solid var(--dsv-border-soft, var(--dsv-border));
  margin-left: 22px;
}

.dsv-scm-commit-file {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 8px 0 6px;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
}

.dsv-scm-commit-file:hover { background: var(--dsv-hover, rgba(127, 127, 127, 0.14)); }
.dsv-scm-commit-file .dsv-file-icon { width: 15px; height: 15px; flex: none; }

.dsv-scm-tip {
  position: fixed;
  z-index: 1300;
  width: 320px;
  padding: 10px 12px;
  box-sizing: border-box;
  background: var(--dsv-panel, var(--dsv-bg));
  border: 1px solid var(--dsv-border);
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
  pointer-events: none;
  font-size: 12px;
}

.dsv-scm-tip-head { display: flex; gap: 6px; align-items: center; color: var(--dsv-fg-dim); font-size: 11px; }
.dsv-scm-tip-author { color: var(--dsv-fg); font-weight: 600; }
.dsv-scm-tip-subject { margin: 6px 0 8px; line-height: 1.5; }
.dsv-scm-tip-meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dsv-scm-tip-hash { font-family: var(--dsv-mono, monospace); font-size: 11px; color: var(--dsv-fg-dim); }

/* ── 空状态 ── */
.dsv-scm-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 16px;
  color: var(--dsv-fg-dim);
  font-size: 12px;
}

.dsv-scm-hint {
  max-width: 260px;
  text-align: center;
  font-size: 11px;
  color: var(--dsv-fg-dim);
  line-height: 1.6;
}

.dsv-scm-root-btn {
  height: 24px;
  padding: 0 10px;
  margin-top: 4px;
  border: 1px solid var(--dsv-border);
  border-radius: 6px;
  background: transparent;
  color: var(--dsv-fg-dim);
  font-size: 11px;
  cursor: pointer;
}

.dsv-scm-root-btn:hover { color: var(--dsv-fg); border-color: var(--dsv-accent); }

/* ── 选择 Git 目录对话框 ── */
.dsv-gitroot-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(460px, calc(100vw - 120px));
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px 16px;
  box-sizing: border-box;
  background: var(--dsv-panel, var(--dsv-bg));
  border: 1px solid var(--dsv-accent, #0078d4);
  border-radius: 12px;
  pointer-events: auto;
  z-index: 1166;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--dsv-accent, #0078d4) 35%, transparent),
    0 18px 48px rgba(0, 0, 0, 0.5);
  font-size: 12px;
}

.dsv-gitroot-head { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.dsv-gitroot-hint { font-size: 11px; opacity: 0.65; line-height: 1.6; }

.dsv-gitroot-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 200px;
  overflow: auto;
}

.dsv-gitroot-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-family: var(--dsv-mono, monospace);
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}

.dsv-gitroot-item:hover { background: var(--dsv-hover, rgba(127, 127, 127, 0.14)); }
.dsv-gitroot-item[data-active="true"] { border-color: var(--dsv-accent); }
.dsv-gitroot-item-icon { opacity: 0.7; }

.dsv-gitroot-input {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  box-sizing: border-box;
  border: 1px solid var(--dsv-border);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-family: var(--dsv-mono, monospace);
  font-size: 11px;
}

.dsv-gitroot-input:focus { outline: none; border-color: var(--dsv-accent); }

.dsv-gitroot-actions { display: flex; gap: 8px; justify-content: flex-end; }

.dsv-gitroot-actions button {
  height: 26px;
  padding: 0 12px;
  border: 1px solid var(--dsv-border);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 11px;
  cursor: pointer;
}

.dsv-gitroot-actions .dsv-gitroot-primary {
  background: var(--dsv-accent, #0078d4);
  border-color: transparent;
  color: #fff;
}

.dsv-gitroot-error { color: #e06c75; font-size: 11px; }

.dsv-scm-empty-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--dsv-border);
  border-radius: 50%;
  font-size: 14px;
  opacity: 0.7;
}
`
