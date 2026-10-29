/** 搜索浮层样式。 */

export const CSS = `
/* 浮层容器：需要时才出现，不占侧栏 */
.dsv-search-overlay {
  position: fixed;
  top: 64px;
  left: 50%;
  transform: translateX(-50%);
  width: min(760px, calc(100vw - 200px));
  max-height: min(68vh, 620px);
  display: flex;
  flex-direction: column;
  background: var(--dsv-panel, var(--dsv-bg));
  border: 1px solid var(--dsv-accent, #0078d4);
  border-radius: 12px;
  overflow: hidden;
  pointer-events: auto;
  z-index: 1165;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--dsv-accent, #0078d4) 35%, transparent),
    0 18px 48px rgba(0, 0, 0, 0.45);
}

.dsv-search {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-size: 12px;
}

/* 浮层里让内容自己撑开，避免 height:100% 在自适应高度下塌成一条 */
.dsv-search-overlay .dsv-search {
  height: auto;
  flex: 1 1 auto;
}

.dsv-search-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--dsv-border);
}

.dsv-search-input {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--dsv-border);
  border-radius: 6px;
  background: var(--dsv-input, transparent);
  color: var(--dsv-fg);
  font-family: var(--dsv-mono, monospace);
  font-size: 11px;
}

.dsv-search-input:focus { outline: none; border-color: var(--dsv-accent); }

.dsv-search-toggle {
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--dsv-fg);
  font-family: var(--dsv-mono, monospace);
  font-size: 11px;
  cursor: pointer;
  opacity: 0.55;
}

.dsv-search-toggle:hover { background: var(--dsv-hover, rgba(127, 127, 127, 0.16)); opacity: 0.9; }

.dsv-search-toggle[data-active="true"] {
  border-color: var(--dsv-accent);
  color: var(--dsv-accent);
  opacity: 1;
}

.dsv-search-meta {
  flex: none;
  padding: 6px 10px;
  font-size: 11px;
  opacity: 0.62;
  border-bottom: 1px solid var(--dsv-border);
  display: flex;
  gap: 8px;
  align-items: center;
}

.dsv-search-meta[data-state="error"] { color: #e06c75; opacity: 1; }

.dsv-search-results {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 4px 0 12px;
}

.dsv-search-file {
  padding: 6px 10px 2px;
  font-size: 11px;
  font-weight: 600;
  opacity: 0.9;
  display: flex;
  gap: 6px;
  align-items: baseline;
  position: sticky;
  top: 0;
  background: var(--dsv-sidebar-bg, var(--dsv-bg));
  cursor: pointer;
}

.dsv-search-file-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.dsv-search-file-count { flex: none; opacity: 0.5; font-weight: 400; }

.dsv-search-hit {
  display: flex;
  gap: 8px;
  padding: 2px 10px 2px 16px;
  cursor: pointer;
  border-left: 2px solid transparent;
}

.dsv-search-hit:hover { background: var(--dsv-hover, rgba(127, 127, 127, 0.14)); }

.dsv-search-hit[data-active="true"] { border-left-color: var(--dsv-accent); }

.dsv-search-line {
  flex: none;
  min-width: 34px;
  text-align: right;
  opacity: 0.45;
  font-family: var(--dsv-mono, monospace);
  font-size: 11px;
}

.dsv-search-text {
  font-family: var(--dsv-mono, monospace);
  font-size: 11px;
  white-space: pre;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dsv-search-text mark {
  background: color-mix(in srgb, var(--dsv-accent) 32%, transparent);
  color: inherit;
  border-radius: 2px;
}

.dsv-search-empty {
  padding: 24px 16px;
  font-size: 11px;
  opacity: 0.6;
  line-height: 1.7;
}
`
