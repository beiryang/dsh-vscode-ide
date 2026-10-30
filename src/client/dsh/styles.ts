/** DSH 插槽相关样式：左侧栏入口、设置页分区。 */

export const CSS = `
/* ── 插槽入口（DSH 左侧栏面板里渲染的内容） ── */
/* 上下内边距必须对称：DSH 的列表行距是均等的，只要这里不对称，整行就会显得偏上/偏下 */
.dsv-launcher { padding: 4px 10px; font-size: 12px; color: var(--dsv-fg, var(--dsw-alias-label-primary, #ddd)); }

/* 单个按钮：Code Space。整行铺满，30px 高，和 DSH 列表项行高一致 */
.dsv-open-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 30px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--dsv-accent, #0078d4);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
  cursor: pointer;
  transition: filter 0.12s ease;
}

.dsv-open-btn:hover { filter: brightness(1.08); }
.dsv-open-btn:active { filter: brightness(0.94); }

/* 工作台已打开时按钮转为「按下去」的样式，提示再点一次会关闭 */
.dsv-open-btn[data-open="true"] {
  background: var(--dsv-panel-alt, #2d2d30);
  color: var(--dsv-fg, #ddd);
  border-color: var(--dsv-border, #3c3c3c);
}

/* ── 设置页：分组卡片 ── */
.dsv-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 880px;
  font-size: 12px;
}

/*
 * 设置页统一用微软雅黑：DSH 自己的输入框/按钮/等宽片段各有字体，
 * 这里在 Code Space 设置分区内统一覆盖，避免同一页出现三种字形。
 */
.dsv-settings,
.dsv-settings * {
  font-family: 'Microsoft YaHei', 'Microsoft YaHei UI', '微软雅黑', 'PingFang SC', 'Noto Sans SC', sans-serif !important;
}

.dsv-settings-group {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--dsw-alias-border-l2, #3c3c3c);
  border-radius: 12px;
  overflow: hidden;
}

.dsv-settings-group-title {
  padding: 9px 14px;
  font-size: 11px;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--dsv-fg-faint, #8a8a8a);
  background: color-mix(in srgb, currentColor 6%, transparent);
  border-bottom: 1px solid var(--dsw-alias-border-l1, #333);
}

.dsv-settings-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
}

.dsv-settings-item + .dsv-settings-item {
  border-top: 1px dashed var(--dsw-alias-border-l1, #333);
}

.dsv-settings-item + .dsv-settings-details,
.dsv-settings-group > .dsv-settings-details { border-top: 1px dashed var(--dsw-alias-border-l1, #333); }

.dsv-settings-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.dsv-settings-row button {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2, #3c3c3c);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}

.dsv-settings-row button:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12)); }

.dsv-settings-row button[data-active="true"] {
  background: var(--dsv-accent, #0078d4);
  border-color: transparent;
  color: #fff;
}

.dsv-settings-row button:disabled { opacity: 0.4; cursor: default; }

.dsv-settings-value {
  min-width: 44px;
  text-align: center;
  font-family: var(--dsv-mono, monospace);
  font-size: 12px;
}

.dsv-settings-hint { font-size: 11px; opacity: 0.62; line-height: 1.5; }

.dsv-settings-note {
  padding: 10px 14px;
  font-size: 11px;
  color: #d7ba7d;
  border-top: 1px dashed var(--dsw-alias-border-l1, #333);
}

/* 宿主状态徽标 */
.dsv-settings-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
}

.dsv-settings-status::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.dsv-settings-status[data-state="ok"] { color: #6a9955; background: rgba(106, 153, 85, 0.14); }
.dsv-settings-status[data-state="bad"] { color: #e06c75; background: rgba(224, 108, 117, 0.14); }
.dsv-settings-status[data-state="pending"] { color: #d7ba7d; background: rgba(215, 186, 125, 0.14); }

.dsv-settings-meta { font-size: 11px; opacity: 0.55; font-family: var(--dsv-mono, monospace); }

/* 折叠的原始信息 */
.dsv-settings-details { display: block; }

.dsv-settings-details > summary {
  padding: 9px 14px;
  font-size: 11px;
  opacity: 0.7;
  cursor: pointer;
  user-select: none;
}

.dsv-settings-details > summary:hover { opacity: 1; }

.dsv-settings-label { font-size: 12px; opacity: 0.88; }

.dsv-settings-input {
  flex: 1 1 320px;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l2, #3c3c3c);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-family: var(--dsv-mono, monospace);
  font-size: 11px;
}

.dsv-settings-input:focus { outline: none; border-color: var(--dsv-accent, #0078d4); }

.dsv-settings pre {
  margin: 0 14px 12px;
  padding: 8px 10px;
  max-height: 240px;
  overflow: auto;
  border: 1px solid var(--dsw-alias-border-l2, #3c3c3c);
  border-radius: 8px;
  background: color-mix(in srgb, currentColor 5%, transparent);
  font-family: var(--dsv-mono, monospace);
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
}
`
