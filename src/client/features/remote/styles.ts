/** 远程面板样式（侧栏） */

export const CSS = `
.dsv-remote-path-row { display: flex; gap: 6px; align-items: center; }
.dsv-remote-path-input { flex: 1; min-width: 0; }
.dsv-remote-browse { height: 26px; padding: 0 12px; flex: none; }
.dsv-remote-primary-block { width: 100%; }
.dsv-remote { font-size: 12px; }

.dsv-remote-dim { font-size: 11px; color: var(--dsv-fg-dim); }

.dsv-remote-section { border-bottom: 1px solid var(--dsv-border-soft, var(--dsv-border)); padding: 4px 0 6px; }

.dsv-remote-section-head {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 10px;
  font-size: 11px;
  color: var(--dsv-fg-dim);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.dsv-remote-empty { padding: 6px 10px 8px; color: var(--dsv-fg-dim); font-size: 11px; }

.dsv-remote-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 8px 0 10px;
}

.dsv-remote-row:hover { background: var(--dsv-hover); }

.dsv-remote-name {
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsv-fg);
}

.dsv-remote-meta {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  color: var(--dsv-fg-dim);
}

.dsv-remote-profile,
.dsv-remote-ws {
  height: 30px;
  margin: 3px 6px;
  padding: 0 6px 0 8px;
  border: 1px solid var(--dsv-border);
  border-left: 2px solid var(--dsv-accent);
  border-radius: 5px;
  background: color-mix(in srgb, var(--dsv-accent) 8%, var(--dsv-panel));
}

.dsv-remote-profile:hover,
.dsv-remote-ws:hover { background: color-mix(in srgb, var(--dsv-accent) 14%, var(--dsv-panel)); }

.dsv-remote-profile[data-selected="true"] {
  border-color: var(--dsv-accent);
  border-left-width: 3px;
  background: color-mix(in srgb, var(--dsv-accent) 20%, var(--dsv-panel));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dsv-accent) 35%, transparent);
}

.dsv-remote-current {
  flex: none;
  padding: 0 5px;
  border-radius: 3px;
  background: var(--dsv-accent);
  color: #fff;
  font-size: 9px;
  line-height: 14px;
}

.dsv-remote-profile .dsv-remote-name,
.dsv-remote-ws .dsv-remote-name { font-weight: 600; }

.dsv-remote-dot { flex: none; font-size: 9px; color: var(--dsv-fg-faint, var(--dsv-fg-dim)); }
.dsv-remote-dot[data-ok="true"] { color: #98c379; }

.dsv-remote-act {
  flex: none;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--dsv-fg-dim);
  cursor: pointer;
}

.dsv-remote-act:hover:not(:disabled) { background: var(--dsv-hover); color: var(--dsv-fg); }

.dsv-remote-act-text {
  width: auto;
  min-width: 34px;
  padding: 0 6px;
  font-size: 11px;
  white-space: nowrap;
}
.dsv-remote-act:disabled { opacity: 0.45; cursor: default; }

.dsv-remote-form { display: flex; flex-direction: column; gap: 6px; padding: 4px 10px 8px; }
.dsv-remote-form-row { display: flex; gap: 6px; }

.dsv-remote-input {
  width: 100%;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--dsv-border);
  border-radius: 5px;
  background: var(--dsv-input, transparent);
  color: var(--dsv-fg);
  font-size: 12px;
  outline: none;
}

.dsv-remote-input:focus { border-color: var(--dsv-accent); }

.dsv-remote-primary {
  height: 26px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: var(--dsv-accent);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.dsv-remote-primary:disabled { opacity: 0.5; cursor: default; }

.dsv-remote-entries {
  max-height: 180px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 2px;
  padding: 3px;
  border: 1px solid var(--dsv-border);
  border-radius: 5px;
  background: var(--dsv-bg);
}

.dsv-remote-entry {
  flex: none;
  min-height: 22px;
  line-height: 20px;
  text-align: left;
  padding: 1px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--dsv-fg);
  font-size: 11px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsv-remote-entry:hover { background: var(--dsv-hover); }

.dsv-remote-note {
  margin: 6px 10px 2px;
  padding: 6px 8px;
  border-radius: 5px;
  font-size: 11px;
  line-height: 1.45;
  background: color-mix(in srgb, var(--dsv-accent) 12%, transparent);
  color: var(--dsv-fg);
}

.dsv-remote-note[data-kind="error"] {
  background: color-mix(in srgb, #e06c75 16%, transparent);
  color: #ffb3ba;
}

.dsv-remote-note-close {
  float: right;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.dsv-remote-hint { padding: 4px 10px; font-size: 10px; color: var(--dsv-fg-dim); line-height: 1.45; }
.dsv-remote-foot { padding-top: 8px; }

.dsv-remote-toggle {
  height: 22px;
  min-width: 0;
  padding: 0 6px;
  font-size: 11px;
  white-space: nowrap;
  border: 1px solid var(--dsv-border);
}
`
