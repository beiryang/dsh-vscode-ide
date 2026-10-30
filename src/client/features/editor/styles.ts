/** 编辑器样式：标签条、Monaco 区域、diff、占位页。 */

export const CSS = `
.dsv-editor-view { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }

.dsv-editor-toolbar { flex: none; display: flex; align-items: center; gap: 4px; }

.dsv-editor-toolbar .dsv-tabbar { flex: 1; min-width: 0; }

.dsv-tabbar {
  flex: none;
  height: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border-bottom: 1px solid var(--dsv-border);
  font-size: 12px;
  color: var(--dsv-fg-dim);
}

.dsv-tabbar-name { color: var(--dsv-fg); }

.dsv-tabbar-tag { font-size: 10px; padding: 1px 6px; border: 1px solid var(--dsv-border); border-radius: 999px; color: var(--dsv-fg-dim); }

.dsv-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  text-align: center;
  color: var(--dsv-fg-dim);
  font-size: 12px;
}

.dsv-placeholder strong { color: var(--dsv-fg-dim); font-weight: 600; font-size: 13px; }

.dsv-placeholder kbd {
  font-family: var(--dsv-mono, ui-monospace, monospace);
  font-size: 11px;
  padding: 1px 5px;
  border: 1px solid var(--dsv-border);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: var(--dsv-panel);
  color: var(--dsv-fg-dim);
}

.dsv-preview {
  flex: 1;
  margin: 0;
  padding: 10px 14px 24px;
  overflow: auto;
  font-family: var(--dsv-mono, ui-monospace, SFMono-Regular, Consolas, monospace);
  font-size: 12px;
  line-height: 1.55;
  tab-size: 2;
  white-space: pre;
  color: var(--dsv-fg);
  background: var(--dsv-bg);
}

.dsv-tabbar-tabs { gap: 8px; padding: 0 8px 0 0; }

.dsv-tabs { flex: 1; min-width: 0; display: flex; align-items: stretch; overflow-x: auto; scrollbar-width: thin; }

.dsv-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 31px;
  padding: 0 6px 0 10px;
  max-width: 220px;
  font-size: 12px;
  color: var(--dsv-fg-dim);
  border-right: 1px solid var(--dsv-border-soft);
  cursor: pointer;
  white-space: nowrap;
}

.dsv-tab:hover { background: var(--dsv-hover); }

.dsv-tab[data-active="true"] {
  color: var(--dsv-fg);
  background: var(--dsv-bg);
  box-shadow: inset 0 -1px 0 var(--dsv-accent);
}

.dsv-tab-dot { width: 6px; height: 6px; border-radius: 50%; background: transparent; flex: none; }

.dsv-tab-dot[data-dirty="true"] { background: var(--dsv-accent); }

.dsv-tab-name { overflow: hidden; text-overflow: ellipsis; }

.dsv-tab-tag { font-size: 9px; padding: 0 4px; border: 1px solid var(--dsv-border); border-radius: 3px; color: var(--dsv-fg-dim); }

.dsv-tab-close {
  flex: none;
  width: 16px;
  height: 16px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: inherit;
  opacity: 0.5;
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.dsv-tab-close:hover { opacity: 1; background: var(--dsv-hover); }

.dsv-tab-meta { flex: none; display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--dsv-fg-dim); }

.dsv-tab-dirty { color: var(--dsv-accent); }

.dsv-editor-zone { position: relative; flex: 1; min-height: 0; display: flex; }

.dsv-editor-primary { position: relative; flex: 1; min-width: 0; min-height: 0; display: flex; }

.dsv-editor { flex: 1; min-width: 0; min-height: 0; }

.dsv-editor[data-empty="true"] { visibility: hidden; }

.dsv-diff { flex: 1; min-width: 0; min-height: 0; }

.dsv-editor-zone[data-mode="diff"] .dsv-editor { display: none; }

/*
 * 底色兜底：切换主题 / 窗口缩放后，Monaco 的背景层偶尔会留下旧色（浅色主题时就是白块）。
 * 这些层的可视内容都在 canvas 之上，强制刷成当前主题底色只会消掉残影，不影响渲染。
 */
.dsv-editor,
.dsv-editor .monaco-editor,
.dsv-editor .monaco-editor-background,
.dsv-editor .monaco-editor .margin,
.dsv-diff,
.dsv-diff .monaco-editor,
.dsv-diff .monaco-editor-background,
.dsv-diff .monaco-editor .margin {
  background-color: var(--dsv-bg, #1e1e1e) !important;
}

.dsv-editor-zone[data-mode="edit"] .dsv-diff { display: none; }

.dsv-placeholder-overlay { position: absolute; inset: 0; }

.dsv-hint { font-size: 11px; color: var(--dsv-fg-dim); }

.dsv-editor-toast {
  position: absolute;
  left: 14px;
  bottom: 14px;
  max-width: calc(100% - 28px);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  background: var(--dsv-panel-alt);
  border: 1px solid var(--dsv-border);
  color: var(--dsv-fg-dim);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.24);
}

.dsv-editor-toast[data-kind="error"] { color: #e06c75; border-color: #e06c7566; }

/* 标签右键菜单 / 拖拽指示 / 预览态 */
.dsv-tab[data-preview="true"] .dsv-tab-name { font-style: italic; }

.dsv-tab[data-drop="true"] { box-shadow: inset 2px 0 0 var(--dsv-accent); }

.dsv-tab-menu {
  position: fixed;
  z-index: 1400;
  min-width: 160px;
  padding: 4px;
  border: 1px solid var(--dsv-border);
  border-radius: 6px;
  background: var(--dsv-panel);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.4);
}

.dsv-tab-menu-item {
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

.dsv-tab-menu-item:hover { background: var(--dsv-hover); }

/* 问题面板（浮层） */
.dsv-problems {
  position: fixed;
  left: 50%;
  bottom: 12%;
  transform: translateX(-50%);
  width: min(760px, 86vw);
  max-height: 58vh;
  display: flex;
  flex-direction: column;
  z-index: 1300;
  border: 1px solid var(--dsv-border);
  border-radius: 8px;
  background: var(--dsv-panel);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.dsv-problems-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 32px;
  padding: 0 10px;
  border-bottom: 1px solid var(--dsv-border-soft, var(--dsv-border));
}

.dsv-problems-title { font-size: 12px; font-weight: 600; }
.dsv-problems-count { font-size: 11px; color: var(--dsv-fg-dim); }
.dsv-problems-count[data-kind="error"] { color: #e06c75; }
.dsv-problems-count[data-kind="warning"] { color: #d7ba7d; }

.dsv-problems-body { flex: 1; min-height: 0; overflow: auto; padding: 4px 0 8px; }
.dsv-problems-empty { padding: 20px 16px; font-size: 12px; color: var(--dsv-fg-dim); text-align: center; }

.dsv-problems-file {
  padding: 6px 12px 2px;
  font-size: 11px;
  color: var(--dsv-fg-dim);
  border-top: 1px solid var(--dsv-border-soft, var(--dsv-border));
}

.dsv-problems-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 24px;
  padding: 0 12px;
  font-size: 12px;
  cursor: pointer;
}

.dsv-problems-row:hover { background: var(--dsv-hover); }
.dsv-problems-icon[data-severity="error"] { color: #e06c75; }
.dsv-problems-icon[data-severity="warning"] { color: #d7ba7d; }
.dsv-problems-icon[data-severity="info"] { color: #61afef; }
.dsv-problems-icon[data-severity="hint"] { color: var(--dsv-fg-dim); }

.dsv-problems-message {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsv-problems-pos { flex: none; font-size: 11px; color: var(--dsv-fg-dim); font-family: var(--dsv-mono, monospace); }

/* 右侧分屏 */
.dsv-split {
  flex: 0 0 46%;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--dsv-border);
  margin-left: 1px;
}

.dsv-split-head {
  flex: none;
  height: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border-bottom: 1px solid var(--dsv-border-soft, var(--dsv-border));
  font-size: 11px;
  color: var(--dsv-fg-dim);
}

.dsv-split-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsv-fg);
}

.dsv-split-crumbs {
  flex: none;
  height: 24px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  border-bottom: 1px solid var(--dsv-border-soft, var(--dsv-border));
  font-size: 11px;
  color: var(--dsv-fg-dim);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.dsv-split-editor { flex: 1; min-height: 0; position: relative; }

.dsv-split-editor .monaco-editor { position: absolute; inset: 0; }
`
