/** 终端样式：SSH 面板与本地命令控制台。 */

export const CSS = `
/* ── SSH 连接对话框 ── */
.dsv-ssh-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(520px, calc(100vw - 120px));
  max-height: min(80vh, 620px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px 16px;
  box-sizing: border-box;
  background: var(--dsv-panel, var(--dsv-bg));
  border: 1px solid var(--dsv-accent, #0078d4);
  border-radius: 12px;
  overflow: auto;
  pointer-events: auto;
  z-index: 1166;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--dsv-accent, #0078d4) 35%, transparent),
    0 18px 48px rgba(0, 0, 0, 0.5);
  font-size: 12px;
}

.dsv-ssh-head { display: flex; align-items: center; gap: 8px; font-weight: 600; }

.dsv-ssh-form { display: flex; flex-wrap: wrap; gap: 10px; }

.dsv-ssh-field { display: flex; flex-direction: column; gap: 4px; flex: 1 1 200px; min-width: 0; }
.dsv-ssh-field > span { font-size: 11px; opacity: 0.65; }
.dsv-ssh-field.dsv-ssh-narrow { flex: 0 0 90px; }
.dsv-ssh-field.dsv-ssh-wide { flex: 1 1 100%; }
.dsv-ssh-field.dsv-ssh-auth { flex: 0 0 auto; }

.dsv-ssh-field input {
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--dsv-border);
  border-radius: 6px;
  background: var(--dsv-bg);
  color: inherit;
  font-family: var(--dsv-mono, monospace);
  font-size: 12px;
}

.dsv-ssh-field input:focus { outline: none; border-color: var(--dsv-accent); }

.dsv-ssh-row { display: flex; gap: 6px; }

.dsv-ssh-row button,
.dsv-ssh-actions button {
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--dsv-border);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}

.dsv-ssh-row button[data-active="true"] {
  border-color: var(--dsv-accent);
  color: var(--dsv-accent);
}

.dsv-ssh-remember { display: flex; align-items: center; gap: 6px; font-size: 11px; opacity: 0.8; }

.dsv-ssh-actions { display: flex; gap: 8px; justify-content: flex-end; }

.dsv-ssh-actions .dsv-ssh-primary {
  background: var(--dsv-accent, #0078d4);
  border-color: transparent;
  color: #fff;
}

.dsv-ssh-actions button:disabled { opacity: 0.45; cursor: default; }

.dsv-ssh-error {
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(224, 108, 117, 0.14);
  color: #e06c75;
  line-height: 1.5;
  word-break: break-word;
}

.dsv-ssh-hosts { display: flex; flex-direction: column; gap: 2px; max-height: 140px; overflow: auto; }

.dsv-ssh-host {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.dsv-ssh-host:hover { background: var(--dsv-hover, rgba(127, 127, 127, 0.14)); }

.dsv-ssh-host-name { font-family: var(--dsv-mono, monospace); }
.dsv-ssh-host-key { margin-left: auto; font-size: 11px; opacity: 0.45; }

.dsv-ssh-host-del {
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  opacity: 0.5;
  cursor: pointer;
}

.dsv-ssh-host-del:hover { opacity: 1; background: rgba(224, 108, 117, 0.18); }

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

.dsv-term-resize { position: absolute; top: -4px; left: 0; right: 0; height: 8px; cursor: ns-resize; z-index: 3; }

/* 折叠成一条线：只留可拖拽的横条，头部和内容都隐藏 */
.dsv-term[data-collapsed="true"] {
  overflow: hidden;
  background: transparent;
  border-top: 1px solid var(--dsv-accent);
}

.dsv-term[data-collapsed="true"] .dsv-term-head,
.dsv-term[data-collapsed="true"] .dsv-term-body { display: none; }

.dsv-term[data-collapsed="true"] .dsv-term-resize {
  top: -4px;
  height: 18px;
  background: transparent;
}

.dsv-term[data-collapsed="true"] .dsv-term-resize:hover { background: color-mix(in srgb, var(--dsv-accent) 22%, transparent); }

/* 右侧停靠：竖着占满高度，拖拽手柄换成左边缘 */
.dsv-term[data-dock="right"] {
  border-top: none;
  height: 100%;
}

.dsv-term[data-dock="right"] .dsv-term-resize {
  top: 0;
  bottom: 0;
  left: -3px;
  right: auto;
  width: 6px;
  height: auto;
  cursor: ew-resize;
}

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

.dsv-term-body { flex: 1; min-height: 0; position: relative; overflow: hidden; }

.dsv-term-view { position: absolute; inset: 0; padding: 4px 6px; box-sizing: border-box; overflow: hidden; display: none; background: var(--dsv-bg); }

.dsv-term-view[data-active="true"] { display: block; }

.dsv-term-view .xterm { height: 100%; }

.dsv-term-empty { padding: 12px; font-size: 11px; color: var(--dsv-fg-dim); }

/* ── 本地命令控制台（非 PTY） ── */
.dsv-local[data-active="true"] { display: flex; flex-direction: column; }

.dsv-local {
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.dsv-local-scroll {
  position: absolute;
  inset: 0;
  overflow: auto;
  padding: 6px 10px 10px;
  font-family: var(--dsv-mono, monospace);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.dsv-local-out { color: var(--dsv-fg); }

.dsv-local-hint { color: var(--dsv-fg-dim); }

.dsv-local-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.dsv-local-prompt {
  flex: none;
  color: var(--dsv-accent);
  user-select: none;
}

.dsv-local-input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--dsv-fg);
  font: inherit;
  padding: 0;
  caret-color: var(--dsv-accent);
}

.dsv-local-toolbar {
  position: absolute;
  top: 4px;
  right: 8px;
  display: flex;
  gap: 4px;
  opacity: 0.8;
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

/* 终端右键菜单与重命名对话框 */
.dsv-term-menu {
  position: fixed;
  z-index: 1400;
  min-width: 190px;
  padding: 4px;
  border: 1px solid var(--dsv-border);
  border-radius: 6px;
  background: var(--dsv-panel);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.4);
}

.dsv-term-menu-item {
  display: block;
  width: 100%;
  padding: 5px 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsv-fg);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.dsv-term-menu-item:hover { background: var(--dsv-hover); }
.dsv-term-menu-item[data-danger="true"] { color: #e06c75; }
.dsv-term-menu-item:disabled { opacity: 0.45; cursor: default; }

.dsv-term-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
}

.dsv-term-dialog {
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--dsv-border);
  border-radius: 8px;
  background: var(--dsv-panel);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
}

.dsv-term-dialog-title { font-size: 13px; font-weight: 600; }

.dsv-term-dialog-input {
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--dsv-border);
  border-radius: 4px;
  background: var(--dsv-bg);
  color: var(--dsv-fg);
  font-size: 12px;
}

.dsv-term-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }

.dsv-term-dialog-btn {
  height: 26px;
  padding: 0 12px;
  border: 1px solid var(--dsv-border);
  border-radius: 4px;
  background: transparent;
  color: var(--dsv-fg);
  font-size: 12px;
  cursor: pointer;
}

.dsv-term-dialog-btn[data-primary="true"] {
  border-color: transparent;
  background: var(--dsv-accent);
  color: #fff;
}

/* SSH 会话徽标与"远程终端"一次性提示 */
.dsv-term-tab-remote {
  padding: 0 4px;
  border-radius: 3px;
  background: color-mix(in srgb, #d7ba7d 30%, transparent);
  color: #f0dfb4;
  font-size: 9px;
  line-height: 14px;
  flex: none;
}

.dsv-term-banner {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-bottom: 1px solid var(--dsv-border-soft, var(--dsv-border));
  background: color-mix(in srgb, #d7ba7d 14%, transparent);
  color: var(--dsv-fg);
  font-size: 11px;
}

.dsv-term-banner-text { flex: 1; min-width: 0; }

/* 提示条里的按钮：不要用固定宽高的 mini-btn（英文会被挤成竖排） */
.dsv-term-banner .dsv-mini-btn {
  flex: none;
  width: auto;
  height: 20px;
  padding: 0 8px;
  font-size: 11px;
  white-space: nowrap;
}
`
