/**
 * 内核样式：窗口壳、标题栏、侧栏容器、状态栏、命令面板等共享组件。
 * feature 样式在各自目录的 styles.ts 里，通过 registry.addStyles() 注入。
 */

export const CSS = `
/*
 * Electron 的窗口拖拽区（-webkit-app-region: drag）会吞掉指针事件：
 * 只要浮层和 DSH 顶栏那条拖拽带重叠，里面的按钮就"点了没反应"、拖动也只会拖 DSH 窗口。
 * 所以整个浮层树一律声明 no-drag —— 提 z-index 是没用的，事件根本不下发。
 */
[data-dsv-host],
[data-dsv-host] *,
.dsv-root,
.dsv-root * {
  -webkit-app-region: no-drag !important;
  app-region: no-drag !important;
}

.dsv-window input::placeholder,
.dsv-window textarea::placeholder {
  color: var(--dsv-fg-dim);
  opacity: 0.9;
}

.dsv-window ::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.dsv-window ::-webkit-scrollbar-track { background: transparent; }

.dsv-window ::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--dsv-fg) 22%, transparent);
  border: 2px solid transparent;
  border-radius: 6px;
  background-clip: padding-box;
}

.dsv-window ::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--dsv-fg) 34%, transparent);
  background-clip: padding-box;
}

.dsv-window ::-webkit-scrollbar-corner { background: transparent; }

.dsv-root {
  position: fixed;
  inset: 0;
  z-index: 1150;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
  color: var(--dsv-fg);
}

/* 速览：藏起工作台看 DSH（组件保持挂载，编辑器状态不丢） */
.dsv-window[data-peek="true"] { display: none !important; }

/* 速览浮钮：等价 Ctrl+Alt+Q，可拖动；窗口隐藏时它仍然存在，用来点回来 */
.dsv-peek-fab {
  position: fixed;
  z-index: 1160;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 56px;
  height: 32px;
  padding: 0 14px;
  /*
   * 深色背景下不能只靠深灰底+深灰边（会糊进背景）。
   * 这里用主色描边 + 主色底调 + 外发光，任何背景上都能看出这个按钮。
   */
  border: 1px solid var(--dsv-accent, #0078d4);
  border-radius: 999px;
  background: color-mix(in srgb, var(--dsv-accent, #0078d4) 18%, var(--dsv-bg, #282c34));
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: grab;
  pointer-events: auto;
  user-select: none;
  touch-action: none;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--dsv-accent, #0078d4) 50%, transparent),
    0 0 14px color-mix(in srgb, var(--dsv-accent, #0078d4) 45%, transparent),
    0 6px 20px rgba(0, 0, 0, 0.45);
  transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease, box-shadow 0.12s ease;
}

/* 前面一个小圆点：远看也能认出这是“切对话”的按钮 */
.dsv-peek-fab::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.85;
}

.dsv-peek-fab[data-dragging="true"] { cursor: grabbing; }

.dsv-peek-fab:hover {
  background: color-mix(in srgb, var(--dsv-accent, #0078d4) 38%, var(--dsv-panel-alt, #2d2d30));
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--dsv-accent, #0078d4) 75%, transparent),
    0 0 18px color-mix(in srgb, var(--dsv-accent, #0078d4) 60%, transparent),
    0 6px 20px rgba(0, 0, 0, 0.45);
}

/* 已经速览（窗口隐藏）时整颗实心主色，提示“点我回去” */
.dsv-peek-fab[data-peek="true"] {
  background: var(--dsv-accent, #0078d4);
  border-color: color-mix(in srgb, #fff 35%, transparent);
  color: #fff;
}

.dsv-window {
  position: fixed;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  min-width: 720px;
  min-height: 460px;
  box-sizing: border-box;
  background: var(--dsv-bg);
  /*
   * 高亮边框：窗口常被拖到对话区上，如果边框和 DSH 背景同色就分不清边界。
   * 这里用主色描一圈 + 外发光，深浅主题下都能一眼看出「这是我的窗口」。
   */
  border: 1px solid var(--dsv-accent, #0078d4);
  border-radius: 10px;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--dsv-accent, #0078d4) 40%, transparent),
    0 0 16px color-mix(in srgb, var(--dsv-accent, #0078d4) 18%, transparent),
    0 18px 42px color-mix(in srgb, var(--dsv-fg, #000) 22%, transparent);
  overflow: hidden;
}

.dsv-titlebar {
  flex: none;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px 0 12px;
  background: var(--dsv-panel);
  border-bottom: 1px solid var(--dsv-border);
  cursor: move;
  user-select: none;
}

.dsv-titlebar-title { font-size: 12px; font-weight: 600; letter-spacing: .2px; }

.dsv-titlebar-path {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: var(--dsv-fg-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsv-titlebar-actions { display: flex; gap: 2px; flex: none; }

.dsv-titlebar-actions button {
  width: 26px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--dsv-fg-dim);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}

.dsv-titlebar-actions button:hover { background: var(--dsv-hover); color: var(--dsv-fg); }

.dsv-body { flex: 1; min-height: 0; display: flex; }

.dsv-sidebar-resize {
  flex: none;
  position: relative;
  width: 5px;
  margin-left: -2px;
  cursor: ew-resize;
  background: transparent;
  z-index: 5;
  touch-action: none;
}

/* 只在悬停时显示 1px 细线，静止时就是侧栏原有边框 */
.dsv-sidebar-resize::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 2px;
  width: 1px;
  background: transparent;
}

.dsv-sidebar-resize:hover::after {
  background: var(--dsv-accent);
}

.dsv-activitybar {
  flex: none;
  width: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 0;
  background: var(--dsv-panel);
  border-right: 1px solid var(--dsv-border);
}

.dsv-activity-btn {
  position: relative;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsv-fg-dim);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dsv-activity-btn:hover { background: var(--dsv-hover); color: var(--dsv-fg); }

.dsv-activity-btn[data-active="true"] { color: var(--dsv-fg); background: var(--dsv-hover); }

.dsv-activity-btn[data-active="true"]::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 1px;
  background: var(--dsv-accent);
}

.dsv-activity-svg {
  width: 22px;
  height: 22px;
  display: block;
}

.dsv-activity-icon { font-size: 16px; line-height: 1; }
.dsv-activity-label { display: none; }

.dsv-sidebar {
  flex: none;
  width: 264px;
  min-width: 210px;
  max-width: 46%;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  background: var(--dsv-panel);
  border-right: 1px solid var(--dsv-border);
  overflow: hidden;
}

.dsv-sidebar-head {
  flex: none;
  height: 30px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  font-size: 11px;
  letter-spacing: .6px;
  text-transform: uppercase;
  color: var(--dsv-fg-faint);
}

.dsv-main { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--dsv-bg); }

.dsv-main > *:not(.dsv-panel-bottom) { min-height: 0; }

.dsv-panel-bottom {
  flex: none;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.dsv-panel-dock:empty { border-left: none; }

.dsv-panel-dock {
  flex: none;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-left: 1px solid var(--dsv-border);
}

.dsv-status-item { display: inline-flex; align-items: center; }

.dsv-statusbar {
  flex: none;
  height: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 10px;
  font-size: 11px;
  color: var(--dsv-fg-dim);
  background: var(--dsv-panel-alt);
  border-top: 1px solid var(--dsv-border);
}

.dsv-statusbar .dsv-spacer { flex: 1; }

.dsv-statusbar .dsv-dot { width: 7px; height: 7px; border-radius: 50%; background: #6a9955; display: inline-block; margin-right: 5px; }

.dsv-statusbar .dsv-dot[data-state="bad"] { background: #e06c75; }

.dsv-statusbar .dsv-dot[data-state="warn"] { background: #d7ba7d; }

.dsv-handle { position: absolute; z-index: 2; }

.dsv-handle[data-h="n"] { top: -3px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }

.dsv-handle[data-h="s"] { bottom: -3px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }

.dsv-handle[data-h="w"] { left: -3px; top: 8px; bottom: 8px; width: 6px; cursor: ew-resize; }

.dsv-handle[data-h="e"] { right: -3px; top: 8px; bottom: 8px; width: 6px; cursor: ew-resize; }

.dsv-handle[data-h="nw"] { top: -3px; left: -3px; width: 12px; height: 12px; cursor: nwse-resize; }

.dsv-handle[data-h="ne"] { top: -3px; right: -3px; width: 12px; height: 12px; cursor: nesw-resize; }

.dsv-handle[data-h="sw"] { bottom: -3px; left: -3px; width: 12px; height: 12px; cursor: nesw-resize; }

.dsv-handle[data-h="se"] { bottom: -3px; right: -3px; width: 12px; height: 12px; cursor: nwse-resize; }

/* ── Phase 1：多标签 + Monaco 编辑器 ── */
.dsv-main { position: relative; }

.dsv-titlebar-badge {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--dsv-panel-alt);
  color: var(--dsv-fg-dim);
  margin-right: 4px;
}

/* ── 快速打开 / 命令面板 ── */
.dsv-palette-mask {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 48px;
  background: rgba(0, 0, 0, 0.18);
}

.dsv-palette {
  width: min(640px, calc(100% - 32px));
  max-height: calc(100% - 96px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid var(--dsv-border);
  background: var(--dsv-panel);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.36);
}

.dsv-palette-input {
  flex: none;
  height: 38px;
  padding: 0 12px;
  border: 0;
  border-bottom: 1px solid var(--dsv-border);
  outline: none;
  background: var(--dsv-input, var(--dsv-bg));
  color: var(--dsv-fg);
  font-size: 13px;
  font-family: inherit;
}

.dsv-palette-list { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 0; }

.dsv-palette-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.dsv-palette-item[data-active="true"] { background: var(--dsv-accent); color: #fff; }

.dsv-palette-item[data-active="true"] .dsv-palette-detail,

.dsv-palette-item[data-active="true"] .dsv-palette-hint { color: rgba(255, 255, 255, 0.8); }

.dsv-palette-label { flex: none; max-width: 55%; overflow: hidden; text-overflow: ellipsis; }

.dsv-palette-detail { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--dsv-fg-dim); font-size: 11px; }

.dsv-palette-hint { flex: none; color: var(--dsv-fg-dim); font-size: 10px; font-family: var(--dsv-mono, monospace); }

.dsv-palette-empty { padding: 16px 12px; font-size: 12px; color: var(--dsv-fg-faint); text-align: center; }

.dsv-palette-foot {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 24px;
  padding: 0 12px;
  border-top: 1px solid var(--dsv-border);
  font-size: 10px;
  color: var(--dsv-fg-faint);
}

/* ── Phase 5：侧栏页签 + 源代码管理 ── */
.dsv-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }

.dsv-panel-head {
  flex: none;
  height: 28px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  font-size: 11px;
  letter-spacing: .4px;
  color: var(--dsv-fg-faint);
}

.dsv-sidebar-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.dsv-sidebar-head {
  flex: none;
  height: 26px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 11px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--dsv-fg-dim);
  border-bottom: 1px solid var(--dsv-border-soft, var(--dsv-border));
}

.dsv-sidebar-tabs { flex: none; display: flex; gap: 2px; padding: 4px 6px 0; }

/* 隐藏视图（设置）进去后顶部的窄条：返回 + 标题 */
.dsv-sidebar-floating-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 2px;
}
.dsv-sidebar-floating-title { font-size: 11px; letter-spacing: .4px; color: var(--dsv-fg-dim); }

.dsv-sidebar-tab-icon { margin-right: 5px; font-size: 11px; opacity: 0.75; }

.dsv-sidebar-tab {
  flex: 1;
  height: 26px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--dsv-fg-dim);
  font-size: 11px;
  cursor: pointer;
}

.dsv-sidebar-tab:hover { background: var(--dsv-hover); }

.dsv-sidebar-tab[data-active="true"] { background: var(--dsv-panel-alt); color: var(--dsv-fg); }

.dsv-mini-btn {
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsv-fg-dim);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.dsv-mini-btn:hover { background: var(--dsv-hover); color: var(--dsv-fg); }

.dsv-status-btn {
  border: 0;
  background: transparent;
  color: var(--dsv-fg-dim);
  font-size: 11px;
  cursor: pointer;
  padding: 0 6px;
  height: 18px;
  border-radius: 4px;
}

.dsv-status-btn:hover { background: var(--dsv-hover); color: var(--dsv-fg); }

.dsv-remote-chip {
  padding: 0 6px;
  border-radius: 999px;
  background: var(--dsv-panel-alt);
  color: var(--dsv-fg-dim);
  font-size: 10px;
  line-height: 16px;
}
`
