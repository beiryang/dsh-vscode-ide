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

/* DSH「添加工作区」目录流程的远程扩展（跟随 DSH 主题变量） */
.dsv-dirflow-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2400;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
}

.dsv-dirflow {
  width: min(620px, 94vw);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de);
  border-radius: 10px;
  background: var(--dsw-alias-bg-l1, #fff);
  color: var(--dsw-alias-label-primary, #1f2328);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}

.dsv-dirflow-head {
  flex: none;
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 600;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #d0d7de);
}

.dsv-dirflow-close {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.dsv-dirflow-tabs { display: flex; gap: 0; padding: 10px 14px 0; }

.dsv-dirflow-tab {
  flex: 1;
  height: 34px;
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de);
  background: transparent;
  color: inherit;
  font-size: 13px;
  cursor: pointer;
}

.dsv-dirflow-tab:first-child { border-radius: 6px 0 0 6px; }
.dsv-dirflow-tab:last-child { border-radius: 0 6px 6px 0; border-left: none; }
.dsv-dirflow-tab[data-active="true"] { background: #2f6feb; border-color: #2f6feb; color: #fff; }

.dsv-dirflow-body { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px 14px; overflow: auto; }
.dsv-dirflow-field { display: flex; flex-direction: column; gap: 4px; }
.dsv-dirflow-label { font-size: 12px; color: var(--dsw-alias-label-secondary, #57606a); }
.dsv-dirflow-hint { font-size: 12px; color: var(--dsw-alias-label-secondary, #57606a); line-height: 1.5; }

.dsv-dirflow-input {
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de);
  border-radius: 6px;
  background: var(--dsw-alias-bg-l1, #fff);
  color: inherit;
  font-size: 13px;
  outline: none;
}

.dsv-dirflow-path { display: flex; gap: 6px; }
.dsv-dirflow-path .dsv-dirflow-input { flex: 1; min-width: 0; }

.dsv-dirflow-btn {
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.dsv-dirflow-primary {
  height: 34px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: #2f6feb;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}

.dsv-dirflow-primary:disabled, .dsv-dirflow-btn:disabled { opacity: 0.55; cursor: default; }

.dsv-dirflow-list {
  min-height: 180px;
  max-height: 320px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de);
  border-radius: 6px;
  padding: 4px;
}

.dsv-dirflow-entry {
  flex: none;
  height: 28px;
  text-align: left;
  padding: 0 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 13px;
  cursor: pointer;
}

.dsv-dirflow-entry:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); }
.dsv-dirflow-empty { padding: 12px; font-size: 12px; color: var(--dsw-alias-label-secondary, #57606a); }
.dsv-dirflow-foot { display: flex; justify-content: flex-end; gap: 8px; }
.dsv-dirflow-error { padding: 8px 14px 12px; font-size: 12px; color: #cf222e; }

.dsv-sync-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2500;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

.dsv-sync-dlg {
  width: min(460px, 92vw);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--dsv-border);
  border-radius: 8px;
  background: var(--dsv-panel);
  color: var(--dsv-fg);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
}

.dsv-sync-head { font-size: 12px; font-weight: 600; }
.dsv-sync-field { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--dsv-fg-dim); }
.dsv-sync-input {
  padding: 5px 8px;
  border: 1px solid var(--dsv-border);
  border-radius: 5px;
  background: var(--dsv-bg);
  color: var(--dsv-fg);
  font-size: 12px;
  resize: vertical;
  outline: none;
}
.dsv-sync-input:focus { border-color: var(--dsv-accent); }
.dsv-sync-check { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--dsv-fg); }
.dsv-sync-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.dsv-sync-btn {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--dsv-border);
  border-radius: 5px;
  background: transparent;
  color: var(--dsv-fg);
  font-size: 12px;
  cursor: pointer;
}
.dsv-sync-primary { border-color: transparent; background: var(--dsv-accent); color: #fff; }

.dsv-remote-syncbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 10px;
  padding: 6px 8px;
  border: 1px solid color-mix(in srgb, var(--dsv-accent) 40%, transparent);
  border-radius: 5px;
  background: color-mix(in srgb, var(--dsv-accent) 12%, transparent);
  font-size: 11px;
}
.dsv-remote-syncbar-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsv-remote-syncbar-cancel {
  flex: none;
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--dsv-border);
  border-radius: 4px;
  background: transparent;
  color: var(--dsv-fg);
  font-size: 11px;
  cursor: pointer;
}
`
