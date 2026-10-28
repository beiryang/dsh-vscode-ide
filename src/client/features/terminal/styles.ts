/** 终端样式：SSH 面板与本地命令控制台。 */

export const CSS = `
/* ── Phase 6：终端面板 ── */
.dsv-term {
  flex: none;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-top: 1px solid var(--dsv-border);
  background: var(--dsv-bg);
}

.dsv-term-resize { position: absolute; top: -3px; left: 0; right: 0; height: 6px; cursor: ns-resize; z-index: 3; }

/*
 * 终端头部的按钮是「文字按钮」（＋SSH / ＋本地），而 .dsv-mini-btn 是 20×20 的
 * 方形图标按钮 —— 直接复用会把文字挤成两行。这里单独放宽。
 */
.dsv-term-head .dsv-mini-btn {
  width: auto;
  min-width: 24px;
  height: 22px;
  padding: 0 8px;
  flex: none;
  white-space: nowrap;
  font-size: 11px;
  line-height: 20px;
}

.dsv-term-head {
  flex: none;
  height: 28px;
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 4px;
  padding: 0 6px;
  background: var(--dsv-panel);
  border-bottom: 1px solid var(--dsv-border);
  overflow: hidden;
}

.dsv-term-tabs { display: flex; gap: 2px; overflow-x: auto; max-width: 62%; scrollbar-width: none; }

.dsv-term-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 5px 0 8px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--dsv-fg-dim);
  cursor: pointer;
  white-space: nowrap;
}

.dsv-term-tab:hover { background: var(--dsv-hover); }

.dsv-term-tab[data-active="true"] { background: var(--dsv-panel-alt); color: var(--dsv-fg); }

.dsv-term-tab[data-status="error"] { color: #e06c75; }

.dsv-term-tab[data-status="connecting"] { opacity: 0.7; }

.dsv-term-tab-close {
  width: 14px;
  height: 14px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: inherit;
  opacity: 0.6;
  font-size: 10px;
  line-height: 1;
  padding: 0;
  cursor: pointer;
}

.dsv-term-tab-close:hover { opacity: 1; background: var(--dsv-hover); }

.dsv-term-body { flex: 1; min-height: 0; position: relative; }

.dsv-term-view { position: absolute; inset: 0; padding: 4px 6px; display: none; background: var(--dsv-bg); }

.dsv-term-view[data-active="true"] { display: block; }

.dsv-term-view .xterm { height: 100%; }

.dsv-term-empty { padding: 12px; font-size: 11px; color: var(--dsv-fg-faint); }

/* ── 本地命令控制台（非 PTY） ── */
.dsv-local[data-active="true"] { display: flex; flex-direction: column; }

.dsv-local-out {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 6px 8px;
  overflow: auto;
  font-family: var(--dsv-mono, monospace);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--dsv-fg);
  background: var(--dsv-bg);
}

.dsv-local-input-row {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-top: 1px solid var(--dsv-border);
}

.dsv-local-prompt { color: var(--dsv-accent); font-family: var(--dsv-mono, monospace); font-size: 12px; }

.dsv-local-input {
  flex: 1;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--dsv-border);
  border-radius: 4px;
  background: var(--dsv-input, var(--dsv-bg));
  color: var(--dsv-fg);
  font-family: var(--dsv-mono, monospace);
  font-size: 12px;
  outline: none;
}

.dsv-local-input:focus { border-color: var(--dsv-accent); }
`
