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

.dsv-caret { width: 12px; flex: none; text-align: center; color: var(--dsv-fg-faint); font-size: 10px; }

/* Material Icon Theme 的 sprite 符号：固定 15px，颜色由 SVG 自带 */
.dsv-file-icon { width: 15px; height: 15px; flex: none; display: block; }
.dsv-file-icon[data-placeholder="true"] { width: 15px; }

.dsv-tree-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }

.dsv-tree-row[data-dir="true"] .dsv-tree-name { font-weight: 500; }

.dsv-tree-size { flex: none; font-size: 10px; color: var(--dsv-fg-faint); }

.dsv-tree-note { padding: 4px 12px; font-size: 11px; color: var(--dsv-fg-faint); }

.dsv-tree-error { padding: 8px 12px; font-size: 11px; color: #e06c75; white-space: pre-wrap; }

.dsv-tree-row:hover .dsv-git-row-btn { opacity: 1; border-color: var(--dsv-border); }
`
