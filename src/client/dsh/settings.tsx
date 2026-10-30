/**
 * 设置页分区（DSH `settings.section` 插槽）。
 *
 * Phase 0 只放三件事：版本/宿主信息、运行探针、重置窗口几何。
 * 后续的快捷键、主题、Monaco 选项都会挂在这一节下面。
 */

import * as React from 'react'

import { h } from '../h'
import { customIcons } from '../kernel/custom-icons'
import { api, health } from '../kernel/transport'
import { layout } from '../kernel/layout'
import {
  EDITOR_FONT_CANDIDATES,
  EDITOR_FONT_MAX,
  EDITOR_FONT_MIN,
  EDITOR_TAB_MAX,
  EDITOR_TAB_MIN,
  prefs,
  TERMINAL_FONT_MAX,
  TERMINAL_FONT_MIN
} from '../kernel/prefs'
import { runProbe } from '../kernel/probe'
import { themeStore } from '../kernel/themes'

export function SettingsSection() {
  const themeId = React.useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot)
  const prefsVersion = React.useSyncExternalStore(prefs.subscribe, () => prefs.version)
  void prefsVersion
  const snapshot = prefs.getSnapshot()
  const fontSize = snapshot.terminalFontSize
  const editorFontSize = snapshot.editorFontSize
  const [info, setInfo] = React.useState<Record<string, unknown> | null>(null)
  const [probe, setProbe] = React.useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [themePath, setThemePath] = React.useState('')
  const [iconPath, setIconPath] = React.useState('')
  const [importing, setImporting] = React.useState<'theme' | 'icons' | null>(null)
  const [importNote, setImportNote] = React.useState<string | null>(null)

  const importThemeFile = async () => {
    const path = themePath.trim()
    if (!path || importing) return
    setImporting('theme')
    setImportNote(null)
    try {
      const theme = await api.importTheme(path)
      themeStore.setCustom({ name: theme.name, type: theme.type, colors: theme.colors, rules: theme.rules })
      setImportNote(`已导入主题「${theme.name}」（${theme.rules.length} 条高亮规则）`)
    } catch (cause) {
      setImportNote(`主题导入失败：${cause instanceof Error ? cause.message : String(cause)}`)
    } finally {
      setImporting(null)
    }
  }

  const importIconFile = async () => {
    const path = iconPath.trim()
    if (!path || importing) return
    setImporting('icons')
    setImportNote(null)
    try {
      const payload = await api.importIcons(path)
      customIcons.apply(payload)
      setImportNote(
        `已导入图标「${payload.name}」：${payload.icons} 个${payload.missing ? `（${payload.missing} 个文件缺失）` : ''}`
      )
    } catch (cause) {
      setImportNote(`图标导入失败：${cause instanceof Error ? cause.message : String(cause)}`)
    } finally {
      setImporting(null)
    }
  }

  const check = React.useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const payload = await health()
      setInfo(payload && payload.value ? payload.value : { ok: payload.ok })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }, [])

  const probeRun = React.useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const result = (await runProbe()) as Record<string, unknown>
      setProbe(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }, [])

  React.useEffect(() => {
    void check().catch(() => {})
  }, [check])

  const brief = probe
    ? JSON.stringify(
        {
          origin: (probe.location as Record<string, unknown> | undefined)?.origin,
          sameOriginWorker: (probe.workers as Record<string, unknown> | undefined)?.sameOrigin,
          blobWorker: (probe.workers as Record<string, unknown> | undefined)?.blob,
          host: probe.host,
          slot: (probe.layout as Record<string, unknown> | undefined)?.slot
        },
        null,
        2
      )
    : ''

  const hostInfo = info as
    | { name?: string; version?: string; pid?: number; node?: string; platform?: string; cwd?: string }
    | null

  return h(
    'section',
    { className: 'dsv-settings', 'data-dsv-settings': 'true' },

    /* ── 外观 ─────────────────────────────────────────── */
    h(
      'div',
      { className: 'dsv-settings-group' },
      h('div', { className: 'dsv-settings-group-title' }, '外观'),

      h(
        'div',
        { className: 'dsv-settings-item' },
        h('div', { className: 'dsv-settings-label' }, '主题'),
        h(
          'div',
          { className: 'dsv-settings-row' },
          h(
            'select',
            {
              className: 'dsv-settings-select',
              value: themeId,
              onChange: (event: React.ChangeEvent<HTMLSelectElement>) => themeStore.set(event.target.value)
            },
            h('option', { value: 'follow' }, '跟随 DSH'),
            h('option', { value: 'one-dark' }, 'One Dark Pro'),
            themeStore
              .listCustoms()
              .map((theme) => h('option', { key: theme.id, value: theme.id }, `自定义 · ${theme.label}`))
          )
        ),
        h(
          'div',
          { className: 'dsv-settings-hint' },
          '「跟随 DSH」自动使用当前 DSH 主题；导入的 VS Code 主题也会出现在这个下拉里，可随时切换'
        )
      ),

      h(
        'div',
        { className: 'dsv-settings-item' },
        h('div', { className: 'dsv-settings-label' }, '导入主题（VS Code 主题 JSON 的完整路径）'),
        h(
          'div',
          { className: 'dsv-settings-row' },
          h('input', {
            className: 'dsv-settings-input',
            value: themePath,
            spellCheck: false,
            placeholder: 'C:\\Users\\你\\.vscode\\extensions\\...\\themes\\OneDark-Pro.json',
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => setThemePath(event.target.value)
          }),
          h(
            'button',
            { disabled: importing !== null || !themePath.trim(), onClick: () => void importThemeFile() },
            importing === 'theme' ? '导入中…' : '导入'
          ),
          themeId.startsWith('custom:')
            ? h('button', { onClick: () => themeStore.removeCustom(themeId) }, '移除当前主题')
            : null
        ),
        themeStore.listCustoms().length > 0
          ? h(
              'div',
              { className: 'dsv-settings-hint' },
              `已导入 ${themeStore.listCustoms().length} 个主题：${themeStore
                .listCustoms()
                .map((theme) => theme.label)
                .join('、')}`
            )
          : null
      ),

      h(
        'div',
        { className: 'dsv-settings-item' },
        h('div', { className: 'dsv-settings-label' }, '编辑器字体'),
        h(
          'div',
          { className: 'dsv-settings-row' },
          h('input', {
            className: 'dsv-settings-input',
            list: 'dsv-font-candidates',
            value: prefs.getSnapshot().editorFontFamily,
            spellCheck: false,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => prefs.setEditorFontFamily(event.target.value)
          }),
          h('button', { onClick: () => prefs.resetEditorFontFamily() }, '重置默认'),
          h(
            'datalist',
            { id: 'dsv-font-candidates' },
            EDITOR_FONT_CANDIDATES.map((font) => h('option', { key: font, value: font }))
          )
        ),
        h('div', { className: 'dsv-settings-hint' }, '默认 Maple Mono NF CN Light（中英文同一字体）；改动立即生效')
      ),

      h(
        'div',
        { className: 'dsv-settings-item' },
        h('div', { className: 'dsv-settings-label' }, '编辑器字号'),
        h(
          'div',
          { className: 'dsv-settings-row' },
          h(
            'button',
            {
              disabled: editorFontSize <= EDITOR_FONT_MIN,
              onClick: () => prefs.setEditorFontSize(editorFontSize - 1)
            },
            '−'
          ),
          h('span', { className: 'dsv-settings-value' }, `${editorFontSize}px`),
          h(
            'button',
            {
              disabled: editorFontSize >= EDITOR_FONT_MAX,
              onClick: () => prefs.setEditorFontSize(editorFontSize + 1)
            },
            '＋'
          ),
          h('span', { className: 'dsv-settings-hint' }, `${EDITOR_FONT_MIN}–${EDITOR_FONT_MAX}px`)
        )
      ),

      h(
        'div',
        { className: 'dsv-settings-item' },
        h('div', { className: 'dsv-settings-label' }, '换行与缩进'),
        h(
          'div',
          { className: 'dsv-settings-row' },
          h('span', { className: 'dsv-settings-hint' }, '自动换行'),
          h(
            'button',
            { 'data-active': prefs.getSnapshot().editorWordWrap ? 'true' : 'false', onClick: () => prefs.setEditorWordWrap(!prefs.getSnapshot().editorWordWrap) },
            prefs.getSnapshot().editorWordWrap ? '开' : '关'
          ),
          h('span', { className: 'dsv-settings-hint', style: { marginLeft: '10px' } }, '行号'),
          h(
            'button',
            { 'data-active': prefs.getSnapshot().editorLineNumbers ? 'true' : 'false', onClick: () => prefs.setEditorLineNumbers(!prefs.getSnapshot().editorLineNumbers) },
            prefs.getSnapshot().editorLineNumbers ? '显示' : '隐藏'
          ),
          h('span', { className: 'dsv-settings-hint', style: { marginLeft: '10px' } }, 'Tab'),
          h(
            'button',
            { disabled: prefs.getSnapshot().editorTabSize <= EDITOR_TAB_MIN, onClick: () => prefs.setEditorTabSize(prefs.getSnapshot().editorTabSize - 1) },
            '−'
          ),
          h('span', { className: 'dsv-settings-value' }, String(prefs.getSnapshot().editorTabSize)),
          h(
            'button',
            { disabled: prefs.getSnapshot().editorTabSize >= EDITOR_TAB_MAX, onClick: () => prefs.setEditorTabSize(prefs.getSnapshot().editorTabSize + 1) },
            '＋'
          )
        )
      ),

      h(
        'div',
        { className: 'dsv-settings-item' },
        h('div', { className: 'dsv-settings-label' }, '终端字体'),
        h(
          'div',
          { className: 'dsv-settings-row' },
          h('input', {
            className: 'dsv-settings-input',
            list: 'dsv-font-candidates',
            value: prefs.getSnapshot().terminalFontFamily,
            spellCheck: false,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => prefs.setTerminalFontFamily(event.target.value)
          }),
          h('button', { onClick: () => prefs.resetTerminalFontFamily() }, '重置默认')
        ),
        h('div', { className: 'dsv-settings-hint' }, '默认 Maple Mono NF CN（含 Nerd Font 图标回退）；输入框可直接填任意字体名，改动立即生效')
      ),

      h(
        'div',
        { className: 'dsv-settings-item' },
        h('div', { className: 'dsv-settings-label' }, '终端字号'),
        h(
          'div',
          { className: 'dsv-settings-row' },
          h(
            'button',
            {
              disabled: fontSize <= TERMINAL_FONT_MIN,
              onClick: () => prefs.setTerminalFontSize(fontSize - 1)
            },
            '−'
          ),
          h('span', { className: 'dsv-settings-value' }, `${fontSize}px`),
          h(
            'button',
            {
              disabled: fontSize >= TERMINAL_FONT_MAX,
              onClick: () => prefs.setTerminalFontSize(fontSize + 1)
            },
            '＋'
          ),
          h('span', { className: 'dsv-settings-hint' }, `${TERMINAL_FONT_MIN}–${TERMINAL_FONT_MAX}px，只影响底部终端`)
        )
      )
    ),

    /* ── 扩展资源 ─────────────────────────────────────── */
    h(
      'div',
      { className: 'dsv-settings-group' },
      h('div', { className: 'dsv-settings-group-title' }, '图标'),

      h(
        'div',
        { className: 'dsv-settings-item' },
        h('div', { className: 'dsv-settings-label' }, '导入图标主题（VS Code 图标主题 JSON 的完整路径，同目录需有 SVG）'),
        h(
          'div',
          { className: 'dsv-settings-row' },
          h('input', {
            className: 'dsv-settings-input',
            value: iconPath,
            spellCheck: false,
            placeholder: 'C:\\Users\\你\\.vscode\\extensions\\...\\material-icons.json',
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => setIconPath(event.target.value)
          }),
          h(
            'button',
            { disabled: importing !== null || !iconPath.trim(), onClick: () => void importIconFile() },
            importing === 'icons' ? '导入中…' : '导入'
          ),
          customIcons.getName() ? h('button', { onClick: () => customIcons.clear() }, '恢复内置') : null
        ),
        customIcons.getName() ? h('div', { className: 'dsv-settings-hint' }, `当前图标：${customIcons.getName()}`) : null
      ),

      importNote ? h('div', { className: 'dsv-settings-note' }, importNote) : null
    ),

    /* ── 诊断 ─────────────────────────────────────────── */
    h(
      'div',
      { className: 'dsv-settings-group' },
      h('div', { className: 'dsv-settings-group-title' }, '诊断'),
      h(
        'div',
        { className: 'dsv-settings-item' },
        h(
          'div',
          { className: 'dsv-settings-row' },
          h(
            'span',
            { className: 'dsv-settings-status', 'data-state': info ? 'ok' : error ? 'bad' : 'pending' },
            busy ? '检测中…' : info ? '宿主已连接' : error ? '宿主未连接' : '未检测'
          ),
          hostInfo?.version ? h('span', { className: 'dsv-settings-meta' }, `v${hostInfo.version}`) : null,
          hostInfo?.pid ? h('span', { className: 'dsv-settings-meta' }, `pid ${hostInfo.pid}`) : null,
          hostInfo?.node ? h('span', { className: 'dsv-settings-meta' }, `node ${hostInfo.node}`) : null,
          h('span', { style: { flex: 1 } }),
          h('button', { onClick: () => void check() }, '重新检测')
        ),
        info
          ? h(
              'details',
              { className: 'dsv-settings-details' },
              h('summary', null, '宿主信息'),
              h('pre', null, JSON.stringify(info, null, 2))
            )
          : error
            ? h('div', { className: 'dsv-settings-hint' }, error)
            : null
      ),

      h(
        'div',
        { className: 'dsv-settings-item' },
        h(
          'div',
          { className: 'dsv-settings-row' },
          h('button', { onClick: () => void probeRun(), disabled: busy }, busy ? '诊断中…' : '运行环境诊断'),
          h('button', { onClick: () => layout.resetGeometry() }, '重置窗口几何')
        ),
        h(
          'div',
          { className: 'dsv-settings-hint' },
          '诊断只读取环境信息（页面来源、Worker 可用性、宿主接口、主题变量、插槽尺寸），不修改任何配置；完整结果同时打印到控制台。'
        )
      ),

      brief
        ? h(
            'details',
            { className: 'dsv-settings-details' },
            h('summary', null, '上次诊断摘要'),
            h('pre', null, brief)
          )
        : null
    )
  )
}
