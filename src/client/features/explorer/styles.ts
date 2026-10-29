/** 资源管理器样式：文件树 / 面板容器。 */

export const CSS = `
.dsv-tree { flex: 1; min-height: 0; overflow: auto; padding-bottom: 8px; }

.dsv-tree-row {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding-right: 8px;
  font-size: 12px;
  line-height: 22px;
  cursor: pointer;
  color: var(--dsv-fg);
  white-space: nowrap;
}

.dsv-tree-row:hover { background: var(--dsv-hover); }

.dsv-tree-row[data-active="true"] { background: var(--dsv-panel-alt); }

.dsv-caret { width: 12px; flex: none; text-align: center; color: var(--dsv-fg-dim); font-size: 10px; }

/* Material Icon Theme 的 sprite 符号：固定 15px，颜色由 SVG 自带 */
.dsv-file-icon { width: 15px; height: 15px; flex: none; display: block; }
.dsv-file-icon[data-placeholder="true"] { width: 15px; }

.dsv-tree-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }

.dsv-tree-row[data-dir="true"] .dsv-tree-name { font-weight: 500; }

.dsv-tree-size { flex: none; font-size: 10px; color: var(--dsv-fg-dim); }

.dsv-tree-note { padding: 4px 12px; font-size: 11px; color: var(--dsv-fg-dim); }

.dsv-tree-error { padding: 8px 12px; font-size: 11px; color: #e06c75; white-space: pre-wrap; }
/* 右键菜单与对话框 */
.dsv-tree-menu {
  position: fixed;
  z-index: 1400;
  min-width: 170px;
  padding: 4px;
  border: 1px solid var(--dsv-border);
  border-radius: 6px;
  background: var(--dsv-panel);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.4);
}

.dsv-tree-menu-item {
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

.dsv-tree-menu-item:hover { background: var(--dsv-hover); }
.dsv-tree-menu-item[data-danger="true"] { color: #e06c75; }

.dsv-tree-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
}

.dsv-tree-dialog {
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

.dsv-tree-dialog-title { font-size: 13px; font-weight: 600; }
.dsv-tree-dialog-text { font-size: 12px; color: var(--dsv-fg-dim); line-height: 1.5; }

.dsv-tree-dialog-input {
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--dsv-border);
  border-radius: 4px;
  background: var(--dsv-bg);
  color: var(--dsv-fg);
  font-size: 12px;
}

.dsv-tree-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }

.dsv-tree-dialog-btn {
  height: 26px;
  padding: 0 12px;
  border: 1px solid var(--dsv-border);
  border-radius: 4px;
  background: transparent;
  color: var(--dsv-fg);
  font-size: 12px;
  cursor: pointer;
}

.dsv-tree-dialog-btn[data-primary="true"] {
  border-color: transparent;
  background: var(--dsv-accent);
  color: #fff;
}

.dsv-tree-dialog-btn:disabled { opacity: 0.5; cursor: default; }
`
