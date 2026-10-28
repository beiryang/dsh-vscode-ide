/** 源代码管理样式：变更列表、提交区、行内暂存按钮。 */

export const CSS = `
.dsv-git-code {
  width: 14px;
  flex: none;
  text-align: center;
  font-family: var(--dsv-mono, monospace);
  font-size: 10px;
  font-weight: 700;
  color: var(--dsv-fg-dim);
}

.dsv-git-code[data-code="M"] { color: #d7ba7d; }

.dsv-git-code[data-code="A"], .dsv-git-code[data-code="U"], .dsv-git-code[data-code="?"] { color: #6a9955; }

.dsv-git-code[data-code="D"] { color: #e06c75; }

.dsv-git-code[data-code="R"], .dsv-git-code[data-code="C"] { color: #4fc1ff; }

.dsv-git-dir {
  flex: none;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--dsv-fg-faint);
  font-size: 10px;
}

.dsv-git-counts { color: var(--dsv-fg-faint); font-size: 10px; }

/* ── Git 写操作：提交区与行内按钮 ── */
.dsv-git-commit {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 8px 8px;
  border-bottom: 1px solid var(--dsv-border-soft);
}

.dsv-git-message {
  width: 100%;
  box-sizing: border-box;
  min-height: 44px;
  padding: 5px 7px;
  border: 1px solid var(--dsv-border);
  border-radius: 4px;
  background: var(--dsv-input, var(--dsv-bg));
  color: var(--dsv-fg);
  font: inherit;
  font-size: 12px;
  outline: none;
  resize: vertical;
}

.dsv-git-message:focus { border-color: var(--dsv-accent); }

.dsv-git-actions { display: flex; flex-wrap: wrap; gap: 4px; }

.dsv-git-btn {
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--dsv-border);
  border-radius: 4px;
  background: var(--dsv-panel-alt);
  color: var(--dsv-fg-dim);
  font-size: 11px;
  cursor: pointer;
}

.dsv-git-btn:hover:not(:disabled) { color: var(--dsv-fg); }

.dsv-git-btn:disabled { opacity: 0.45; cursor: default; }

.dsv-git-btn-primary:not(:disabled) { background: var(--dsv-accent); border-color: transparent; color: #fff; }

.dsv-git-note {
  font-size: 11px;
  color: var(--dsv-fg-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsv-git-group {
  padding: 8px 10px 2px;
  font-size: 10px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--dsv-fg-faint);
}

.dsv-git-row-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 2px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--dsv-fg-dim);
  font-size: 12px;
  line-height: 1;
  padding: 0;
  cursor: pointer;
  /* 常驻可见：悬停才出现的话，用户根本找不到这个按钮 */
  opacity: 0.55;
}

.dsv-git-row-btn:hover:not(:disabled) { background: var(--dsv-hover); color: var(--dsv-fg); }

.dsv-git-row-btn:disabled { opacity: 0.25; cursor: default; }

.dsv-git-version { color: var(--dsv-fg-faint); font-size: 10px; opacity: 0.8; }
`
