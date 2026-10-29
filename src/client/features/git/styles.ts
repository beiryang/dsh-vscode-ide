/** 源代码管理样式（VS Code 风格）：分支条、提交区、分组、变更行。 */

export const CSS = `
/* ── 分支条 ── */
.dsv-scm-branch {
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

.dsv-scm-sync { color: var(--dsv-fg-faint); font-size: 10px; }

.dsv-scm-spacer { flex: 1; }

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
  color: var(--dsv-fg-dim);
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
  color: var(--dsv-fg-faint);
  font-size: 10px;
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

/* ── 空状态 ── */
.dsv-scm-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 16px;
  color: var(--dsv-fg-faint);
  font-size: 12px;
}

.dsv-scm-hint {
  max-width: 260px;
  text-align: center;
  font-size: 11px;
  color: var(--dsv-fg-faint);
  line-height: 1.6;
}

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
