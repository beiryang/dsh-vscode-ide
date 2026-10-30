/**
 * 编辑器工作区：模型、标签、保存、脏标记。
 *
 * 核心设计：**一个 Monaco 实例 + 每个文件一个 ITextModel**。
 *   - 切标签只 setModel，撤销栈 / 光标 / 内容天然按文件隔离；
 *   - 未保存内容存活在模型里，切走再回来不会重读磁盘；
 *   - 关闭标签才 dispose 模型。
 *
 * 这就是不依赖 dock、也不需要任何补丁的「多标签」实现。
 */

import { api, type Entry } from '../../../kernel/transport'
import { getDraft, putDraft, removeDraft } from '../drafts'
import { layout } from '../../../kernel/layout'
import { statusInfo } from '../../../kernel/status'
import { problemsStore, type Problem } from '../problems'
import { DEFAULT_EDITOR_FONT, prefs } from '../../../kernel/prefs'
import { isDark } from '../../../kernel/theme'
import { loadMonaco } from './loader'
import { defineThemes, syncTheme, themeName } from './theme'

export type DiffSide = { path: string; name: string; text: string; mtimeMs?: number }

export type WorkspaceTab = {
  key: string
  path: string
  name: string
  dirty: boolean
  readOnly: boolean
  size: number
  truncated: boolean
  /** file = 可编辑标签；diff = 只读对比标签 */
  kind: 'file' | 'diff'
  /** 预览标签：单击打开，被下一次预览打开替换（像 VS Code） */
  preview?: boolean
  diff?: { left: DiffSide; right: DiffSide }
}

export type WorkspaceStatus = {
  phase: 'idle' | 'loading' | 'ready' | 'error'
  message: string | null
}

export type SecondaryPane = { key: string; path: string; name: string }

type Snapshot = {
  tabs: WorkspaceTab[]
  active: string | null
  status: WorkspaceStatus
  editorReady: boolean
  secondary: SecondaryPane | null
}

const EXT_LANGUAGE: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'typescript',
  json: 'json', jsonc: 'json', json5: 'json',
  css: 'css', scss: 'scss', less: 'less',
  html: 'html', htm: 'html', vue: 'html', svelte: 'html',
  md: 'markdown', markdown: 'markdown', mdx: 'markdown',
  py: 'python', pyw: 'python',
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  ps1: 'powershell', psm1: 'powershell', bat: 'bat', cmd: 'bat',
  yaml: 'yaml', yml: 'yaml', toml: 'ini', ini: 'ini', conf: 'ini', env: 'ini', properties: 'ini',
  c: 'cpp', h: 'cpp', cc: 'cpp', cpp: 'cpp', cxx: 'cpp', hpp: 'cpp', cs: 'csharp',
  java: 'java', kt: 'kotlin', go: 'go', rs: 'rust', rb: 'ruby', php: 'php',
  sql: 'sql', lua: 'lua', r: 'r', swift: 'swift', dart: 'dart', scala: 'scala',
  xml: 'xml', svg: 'xml', csproj: 'xml', plist: 'xml',
  dockerfile: 'dockerfile', gitignore: 'plaintext', diff: 'diff', patch: 'diff',
  txt: 'plaintext', log: 'plaintext', csv: 'plaintext'
}

function keyOf(path: string) {
  return path.toLowerCase()
}

function languageOf(name: string): string {
  const lower = name.toLowerCase()
  if (lower === 'dockerfile') return 'dockerfile'
  if (lower === '.gitignore' || lower === '.gitattributes' || lower === '.editorconfig') return 'plaintext'
  if (lower === 'makefile') return 'plaintext'
  const at = lower.lastIndexOf('.')
  if (at === -1) return 'plaintext'
  return EXT_LANGUAGE[lower.slice(at + 1)] ?? 'plaintext'
}

function readCss(name: string, fallback: string): string {
  try {
    return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback
  } catch {
    return fallback
  }
}

function editorFontSize(): number {
  const size = prefs.getSnapshot().editorFontSize
  if (Number.isFinite(size) && size >= 8 && size <= 32) return size
  const raw = readCss('--dsf-editor-font-size', '')
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) && value >= 8 && value <= 32 ? value : 13
}

/** 编辑器字体：用户在设置里选的值优先，未设置时用 DSH 的代码字体变量 */
function editorFontFamily(): string {
  const chosen = prefs.getSnapshot().editorFontFamily
  if (chosen && chosen.trim()) return chosen
  return readCss('--dsv-mono', DEFAULT_EDITOR_FONT)
}

/** 与「编辑器细节设置」相关的 Monaco 选项（创建与改动时共用同一份） */
function editorPrefOptions() {
  const snapshot = prefs.getSnapshot()
  return {
    fontSize: editorFontSize(),
    fontFamily: editorFontFamily(),
    wordWrap: snapshot.editorWordWrap ? ('on' as const) : ('off' as const),
    tabSize: snapshot.editorTabSize,
    lineNumbers: snapshot.editorLineNumbers ? ('on' as const) : ('off' as const)
  }
}

let monacoRef: any = null
let editor: any = null
let container: HTMLElement | null = null
let diffEditor: any = null
let diffContainer: HTMLElement | null = null

const models = new Map<string, any>()
const savedVersion = new Map<string, number>()
/** diff 标签的两个模型（关闭标签时一起 dispose） */
const diffModels = new Map<string, { original: any; modified: any }>()
/** 每个模型基于的磁盘版本（判断草稿是否与磁盘冲突） */
const baseInfo = new Map<string, { size: number; mtimeMs: number }>()
const draftTimers = new Map<string, number>()

const TABS_KEY = 'dsv:tabs.v1'

let tabs: WorkspaceTab[] = []
let cursor = { line: 1, column: 1 }

/** 把当前编辑器状态同步到内核状态栏 */
function pushStatus() {
  const tab = active ? tabOf(active) : undefined
  const model = active ? models.get(active) : undefined
  statusInfo.set({
    line: cursor.line,
    column: cursor.column,
    language: tab ? languageOf(tab.name) : '',
    eol: model ? (model.getEOL() === '\r\n' ? 'CRLF' : 'LF') : ''
  })
}
let active: string | null = null
let status: WorkspaceStatus = { phase: 'idle', message: null }
let editorReady = false
let secondary: SecondaryPane | null = null
let editor2: any = null
let secondaryContainer: HTMLElement | null = null

const listeners = new Set<() => void>()
let snapshot: Snapshot = { tabs, active, status, editorReady, secondary: null }

/** 把各模型上的诊断同步到「问题」面板 */
function publishProblems() {
  if (!monacoRef) return
  const list: Problem[] = []
  for (const [key, model] of models) {
    const tab = tabOf(key)
    const markers = monacoRef.editor.getModelMarkers({ resource: model.uri }) ?? []
    for (const marker of markers) {
      if (!marker.message) continue
      const severity: Problem['severity'] =
        marker.severity === 8 ? 'error' : marker.severity === 4 ? 'warning' : marker.severity === 2 ? 'info' : 'hint'
      list.push({
        path: tab?.path ?? model.uri.fsPath,
        name: tab?.name ?? model.uri.fsPath.split(/[\\/]/).pop() ?? '',
        line: marker.startLineNumber,
        column: marker.startColumn,
        severity,
        message: marker.message,
        source: marker.source ?? ''
      })
    }
  }
  list.sort((a, b) => (a.severity === b.severity ? a.line - b.line : a.severity < b.severity ? -1 : 1))
  problemsStore.set(list)
}

function publish() {
  snapshot = { tabs: tabs.slice(), active, status: { ...status }, editorReady, secondary }
  publishProblems()
  persistTabs()
  for (const listener of listeners) listener()
}

/** 记住打开的标签（只存路径，内容从磁盘/草稿恢复；对比标签不持久化） */
function persistTabs() {
  try {
    const fileTabs = tabs.filter((tab) => tab.kind === 'file')
    const list = fileTabs.slice(0, 20).map((tab) => ({ path: tab.path, name: tab.name }))
    const activeTab = active ? tabOf(active) : undefined
    localStorage.setItem(
      TABS_KEY,
      JSON.stringify({ v: 1, tabs: list, active: activeTab && activeTab.kind === 'file' ? activeTab.path : null })
    )
  } catch {
    /* ignore */
  }
}

/** 内容变化后延迟写草稿，避免每敲一个字都落一次盘 */
function scheduleDraft(key: string) {
  const existing = draftTimers.get(key)
  if (existing) window.clearTimeout(existing)
  const timer = window.setTimeout(() => {
    draftTimers.delete(key)
    const model = models.get(key)
    const tab = tabOf(key)
    if (!model || !tab) return
    if (!tab.dirty) {
      removeDraft(key)
      return
    }
    const base = baseInfo.get(key)
    putDraft(key, {
      text: model.getValue(),
      at: Date.now(),
      size: base?.size ?? 0,
      mtimeMs: base?.mtimeMs ?? 0
    })
  }, 1200)
  draftTimers.set(key, timer)
}

/** 打开文件时把上次没保存的草稿接回来 */
function restoreDraft(key: string, model: any, file: { path: string; text: string; size: number; mtimeMs?: number }) {
  const draft = getDraft(key)
  if (!draft) return false
  if (draft.text === file.text) {
    removeDraft(key)
    return false
  }

  const sameBase = draft.size === file.size && draft.mtimeMs === (file.mtimeMs ?? 0)
  if (!sameBase) {
    const name = file.path.split(/[\\/]/).pop() ?? file.path
    if (!window.confirm(`${name} 在磁盘上已被修改，是否恢复上次未保存的草稿？`)) {
      removeDraft(key)
      return false
    }
  }

  model.setValue(draft.text)
  return true
}

function setStatus(phase: WorkspaceStatus['phase'], message: string | null) {
  if (status.phase === phase && status.message === message) return
  status = { phase, message }
  publish()
}

/** 无条件关闭（脏检查由调用方负责）；不会为空活动标签做兜底 */
function forceClose(key: string) {
  const tab = tabOf(key)
  if (!tab) return
  const index = tabs.findIndex((item) => item.key === key)
  try {
    models.get(key)?.dispose()
  } catch {
    /* ignore */
  }
  const pair = diffModels.get(key)
  if (pair) {
    try {
      pair.original?.dispose()
      pair.modified?.dispose()
    } catch {
      /* ignore */
    }
    diffModels.delete(key)
  }
  models.delete(key)
  savedVersion.delete(key)
  baseInfo.delete(key)
  removeDraft(key)
  const timer = draftTimers.get(key)
  if (timer) window.clearTimeout(timer)
  draftTimers.delete(key)
  tabs = tabs.filter((item) => item.key !== key)
  if (active === key) {
    const next = tabs[Math.min(index, tabs.length - 1)]
    active = next ? next.key : null
  }
  syncEditor()
  publish()
}

function tabOf(key: string) {
  return tabs.find((tab) => tab.key === key)
}

function currentModel() {
  return active ? models.get(active) : undefined
}

/**
 * 从 diff 标签切回文件标签时，编辑器容器在 React 提交前还是 display:none，
 * 这时 focus() 会被浏览器静默忽略 —— 表现就是「行还在、光标没了」。
 * 所以 layout + focus 一律推迟到下一个宏任务（React 已提交、容器已可见）。
 */
function focusEditorSoon() {
  window.setTimeout(() => {
    const target = editor
    if (!target) return
    const tab = active ? tabOf(active) : undefined
    if (tab?.kind === 'diff') return
    try {
      target.layout()
      target.focus()
    } catch {
      /* 编辑器可能已销毁 */
    }
  }, 0)
}

/** 让编辑器显示当前活动模型（标签切换 / 首次挂载都走这里） */
function syncEditor() {
  const tab = active ? tabOf(active) : undefined

  // diff 标签：普通编辑器不动，只切对比编辑器
  if (tab?.kind === 'diff') {
    const pair = diffModels.get(tab.key)
    if (diffEditor && pair) {
      diffEditor.setModel(pair)
      window.setTimeout(() => {
        try {
          diffEditor.layout()
        } catch {
          /* ignore */
        }
      }, 0)
    }
    return
  }

  if (!editor) return
  const model = currentModel()
  if (model) {
    if (editor.getModel() !== model) editor.setModel(model)
    editor.updateOptions({ readOnly: tab?.readOnly === true })
    const position = editor.getPosition?.()
    if (position) cursor = { line: position.lineNumber, column: position.column }
    pushStatus()
    focusEditorSoon()
  } else {
    editor.setModel(null)
  }
}

/** 创建（或复用）对比编辑器 */
/** 让右侧分屏显示 secondary 指向的模型 */
function syncSecondary() {
  if (!editor2) return
  const model = secondary ? models.get(secondary.key) : null
  try {
    if (editor2.getModel() !== model) editor2.setModel(model ?? null)
  } catch {
    /* ignore */
  }
  for (const delay of [0, 60, 200]) {
    window.setTimeout(() => {
      try {
        editor2?.layout()
      } catch {
        /* ignore */
      }
    }, delay)
  }
}

function ensureDiffEditor() {
  if (diffEditor || !diffContainer || !monacoRef) return diffEditor
  diffEditor = monacoRef.editor.createDiffEditor(diffContainer, {
    theme: themeName(),
    automaticLayout: true,
    readOnly: true,
    originalEditable: false,
    renderSideBySide: true,
    enableSplitViewResizing: true,
    renderOverviewRuler: false,
    scrollBeyondLastLine: false,
    ...editorPrefOptions(),
    minimap: { enabled: false },
    scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false }
  })
  return diffEditor
}

function refreshDirty(key: string) {
  const model = models.get(key)
  const tab = tabOf(key)
  if (!model || !tab) return
  const dirty = model.getAlternativeVersionId() !== savedVersion.get(key)
  if (dirty !== tab.dirty) {
    tabs = tabs.map((item) => (item.key === key ? { ...item, dirty } : item))
    publish()
  }
}

/** 单飞加载 Monaco；失败时把完整错误打到控制台，UI 只留一句可点的提示 */
let loadingPromise: Promise<any> | null = null
async function ensureMonaco(): Promise<any> {
  if (monacoRef) return monacoRef
  if (!loadingPromise) {
    setStatus('loading', '正在加载 Monaco…')
    loadingPromise = loadMonaco()
      .then((monaco) => {
        monacoRef = monaco
        return monaco
      })
      .catch((error) => {
        console.error('[dsh-vscode-ide] Monaco 加载失败', error)
        setStatus('error', 'Monaco 加载失败，点这里重试（详细原因见控制台）')
        return null
      })
      .finally(() => {
        loadingPromise = null
      })
  }
  return loadingPromise
}

export const workspace = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  getSnapshot(): Snapshot {
    return snapshot
  },

  /** 把 Monaco 挂到一个容器上（窗口打开时调用） */
  async attach(element: HTMLElement) {
    container = element
    const monaco = await ensureMonaco()
    if (!monaco || editor) return

    defineThemes(monaco, document.body)
    editor = monaco.editor.create(element, {
      theme: themeName(),
      automaticLayout: true,
      ...editorPrefOptions(),
      minimap: { enabled: true, maxColumn: 90, renderCharacters: false },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      renderWhitespace: 'selection',
      detectIndentation: false,
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true },
      padding: { top: 8, bottom: 8 },
      fixedOverflowWidgets: false,
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
      overviewRulerBorder: false,
      renderLineHighlight: 'line',
      wordWrap: 'off'
    } as any)

    editorReady = true
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (active) void workspace.save(active)
    })
    editor.onDidChangeCursorPosition((event: any) => {
      cursor = { line: event.position.lineNumber, column: event.position.column }
      pushStatus()
    })
    editor.onDidChangeModel(() => {
      const position = editor.getPosition?.()
      if (position) cursor = { line: position.lineNumber, column: position.column }
      pushStatus()
    })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => {
      if (active) workspace.close(active)
    })

    syncEditor()
    monaco.editor.onDidChangeMarkers(() => publishProblems())
    publishProblems()
    setStatus('ready', null)
    publish()
  },

  /** 右侧分屏容器 */
  async attachSecondary(element: HTMLElement) {
    secondaryContainer = element
    const monaco = monacoRef ?? (await ensureMonaco())
    if (!monaco) return

    // 容器刚挂上 DOM 时高度可能还是 0，此时创建 Monaco 会得到一个"看不见"的编辑器
    const ensure = (attempt = 0) => {
      if (editor2) {
        syncSecondary()
        return
      }
      if (!element.isConnected || attempt > 20) return
      if (element.clientHeight < 40) {
        requestAnimationFrame(() => ensure(attempt + 1))
        return
      }
      editor2 = monaco.editor.create(element, {
        theme: themeName(),
        automaticLayout: true,
        ...editorPrefOptions(),
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
        overviewRulerBorder: false,
        renderLineHighlight: 'line'
      } as any)
      syncSecondary()
    }
    ensure()
  },

  detachSecondary() {
    try {
      editor2?.dispose()
    } catch {
      /* ignore */
    }
    editor2 = null
    secondaryContainer = null
  },

  /** 在右侧打开一个文件（不清空主编辑器标签） */
  async openSecondary(entry: Entry) {
    layout.open()
    const key = keyOf(entry.path)
    if (!models.has(key)) {
      try {
        const file = await api.read(entry.path)
        if (file.binary) {
          setStatus('error', `${entry.name} 是二进制文件，右侧分屏只处理文本`)
          return
        }
        const monaco = monacoRef ?? (await ensureMonaco())
        if (!monaco) return
        const model = monaco.editor.createModel(file.text, languageOf(entry.name), monaco.Uri.file(file.path))
        models.set(key, model)
        savedVersion.set(key, model.getAlternativeVersionId())
        baseInfo.set(key, { size: file.size, mtimeMs: file.mtimeMs ?? 0 })
        model.onDidChangeContent(() => {
          refreshDirty(key)
          scheduleDraft(key)
        })
      } catch (error) {
        setStatus('error', `右侧打开失败：${error instanceof Error ? error.message : String(error)}`)
        return
      }
    }
    secondary = { key, path: entry.path, name: entry.name }
    syncSecondary()
    publish()
  },

  closeSecondary() {
    secondary = null
    try {
      editor2?.setModel(null)
    } catch {
      /* ignore */
    }
    publish()
  },

  /** 对比编辑器的容器（窗口打开时由 EditorPane 调用） */
  async attachDiff(element: HTMLElement) {
    diffContainer = element
    if (!monacoRef) return
    ensureDiffEditor()
    syncEditor()
  },

  detachDiff() {
    try {
      diffEditor?.dispose()
    } catch {
      /* ignore */
    }
    diffEditor = null
    diffContainer = null
  },

  /** 窗口关闭时销毁编辑器（模型保留，重新打开内容还在） */
  detach() {
    try {
      editor?.dispose()
    } catch {
      /* ignore */
    }
    editor = null
    container = null
    editorReady = false
    publish()
  },

  /** 设置里改了编辑器外观（字体 / 字号 / 换行 / Tab / 行号）：就地更新，不用重开标签 */
  syncEditorOptions() {
    const options = editorPrefOptions()
    try {
      editor?.updateOptions?.(options)
    } catch {
      /* ignore */
    }
    try {
      editor2?.updateOptions?.(options)
    } catch {
      /* ignore */
    }
    try {
      diffEditor?.getOriginalEditor?.()?.updateOptions?.(options)
      diffEditor?.getModifiedEditor?.()?.updateOptions?.(options)
    } catch {
      /* ignore */
    }
    const target = editor
    if (target) {
      requestAnimationFrame(() => {
        try {
          target.layout()
        } catch {
          /* ignore */
        }
      })
    }
  },

  /** 深浅色 / 内置主题切换 */
  syncTheme() {
    if (!monacoRef) return
    syncTheme(monacoRef)
    try {
      editor2?.updateOptions?.({ theme: themeName() })
    } catch {
      /* ignore */
    }
    // 主题切换后整块重排一次，避免背景层残留旧色（浅色主题下就是白块）
    const target = editor
    if (target) {
      requestAnimationFrame(() => {
        try {
          target.layout()
        } catch {
          /* ignore */
        }
      })
    }
  },

  /** 从文件树打开一个文件 */
  async openEntry(entry: Entry, options: { preview?: boolean } = {}) {
    layout.open()
    const key = keyOf(entry.path)
    if (models.has(key)) {
      // 模型可能是在右侧分屏里创建、还没进标签栏的：补一个标签再激活，
      // 否则会出现「内容切了、标题和面包屑还停在旧文件」的情况
      if (!tabOf(key)) {
        const model = models.get(key)
        const dirty = Boolean(model) && model.getAlternativeVersionId() !== savedVersion.get(key)
        const nextTab: WorkspaceTab = {
          key,
          path: entry.path,
          name: entry.name,
          dirty,
          readOnly: false,
          size: 0,
          truncated: false,
          kind: 'file',
          preview: options.preview === true && !dirty
        }
        const previewIndex = options.preview
          ? tabs.findIndex((tab) => tab.preview === true && tab.kind === 'file' && !tab.dirty)
          : -1
        if (previewIndex >= 0) {
          const replaced = tabs[previewIndex]
          if (replaced.key !== key) {
            forceClose(replaced.key)
            const insertAt = Math.min(previewIndex, tabs.length)
            tabs = [...tabs.slice(0, insertAt), nextTab, ...tabs.slice(insertAt)]
          } else {
            tabs = tabs.map((tab) => (tab.key === key ? nextTab : tab))
          }
        } else {
          tabs = [...tabs, nextTab]
        }
      }
      active = key
      syncEditor()
      publish()
      return
    }

    setStatus('loading', `读取 ${entry.name}…`)
    try {
      const file = await api.read(entry.path)
      if (file.binary) {
        setStatus('error', `${entry.name} 是二进制文件，编辑器只处理文本`)
        return
      }
      if (!monacoRef) {
        const monaco = await ensureMonaco()
        if (!monaco) {
          setStatus('error', 'Monaco 未就绪，无法打开文件（原因见控制台）')
          return
        }
      }

      const path = file.path
      const modelKey = keyOf(path)
      let model = models.get(modelKey)
      let restoredDraft = false
      if (!model) {
        model = monacoRef.editor.createModel(file.text, languageOf(entry.name), monacoRef.Uri.file(path))
        models.set(modelKey, model)
        savedVersion.set(modelKey, model.getAlternativeVersionId())
        baseInfo.set(modelKey, { size: file.size, mtimeMs: file.mtimeMs ?? 0 })
        model.onDidChangeContent(() => {
          refreshDirty(modelKey)
          scheduleDraft(modelKey)
        })
        // 注意：草稿是在标签创建之前接回的，那时 refreshDirty 找不到标签，
        // 所以这里的 dirty 必须直接从模型版本号算，不能写死 false
        restoredDraft = restoreDraft(modelKey, model, file)
      }

      const isDirty = model.getAlternativeVersionId() !== savedVersion.get(modelKey)

      const nextTab: WorkspaceTab = {
        key: modelKey,
        path,
        name: entry.name,
        dirty: isDirty,
        readOnly: file.truncated,
        size: file.size,
        truncated: file.truncated,
        kind: 'file',
        preview: options.preview === true && !isDirty
      }

      // 预览模式：替换掉上一个干净的预览标签（未保存的文件不替换）
      const previewIndex = options.preview
        ? tabs.findIndex((tab) => tab.preview === true && tab.kind === 'file' && !tab.dirty)
        : -1
      if (previewIndex >= 0) {
        const replaced = tabs[previewIndex]
        if (replaced.key !== modelKey) {
          // 先回收被替换的预览标签（模型/草稿/版本表），再在原位置放入新标签
          forceClose(replaced.key)
          const insertAt = Math.min(previewIndex, tabs.length)
          tabs = [...tabs.slice(0, insertAt), nextTab, ...tabs.slice(insertAt)]
        } else {
          tabs = tabs.map((tab) => (tab.key === modelKey ? nextTab : tab))
        }
      } else {
        tabs = [...tabs, nextTab]
      }
      active = modelKey
      syncEditor()
      setStatus(
        'ready',
        restoredDraft
          ? `已恢复 ${entry.name} 的未保存草稿`
          : file.truncated
            ? '文件超过 2 MiB，已截断并切换为只读'
            : null
      )
      publish()
    } catch (error) {
      setStatus('error', `打开失败：${error instanceof Error ? error.message : String(error)}`)
    }
  },

  /** 启动时恢复上次打开的标签（窗口本来就是打开的状态才恢复） */
  async restoreTabs() {
    if (tabs.length > 0) return
    if (!layout.getSnapshot().open) return

    let saved: { v?: number; tabs?: Array<{ path?: string; name?: string }>; active?: string } | null = null
    try {
      saved = JSON.parse(localStorage.getItem(TABS_KEY) || 'null')
    } catch {
      saved = null
    }
    if (!saved || saved.v !== 1 || !Array.isArray(saved.tabs)) return

    for (const item of saved.tabs.slice(0, 10)) {
      if (!item || typeof item.path !== 'string') continue
      const name = typeof item.name === 'string' ? item.name : item.path.split(/[\\/]/).pop() ?? item.path
      await workspace.openEntry({ path: item.path, name, dir: false, size: 0, mtimeMs: 0 })
    }

    if (typeof saved.active === 'string') {
      const key = keyOf(saved.active)
      if (models.has(key)) {
        active = key
        syncEditor()
        publish()
      }
    }
  },

  /** 把预览标签固定下来（双击标签 / 双击文件时调用） */
  pin(key: string) {
    let changed = false
    tabs = tabs.map((tab) => {
      if (tab.key === key && tab.preview) {
        changed = true
        return { ...tab, preview: false }
      }
      return tab
    })
    if (changed) publish()
  },

  /** 拖拽排序：把 fromKey 移到 toIndex 的位置 */
  moveTab(fromKey: string, toIndex: number) {
    const from = tabs.findIndex((tab) => tab.key === fromKey)
    if (from < 0) return
    const clamped = Math.max(0, Math.min(toIndex, tabs.length - 1))
    if (clamped === from) return
    const next = tabs.slice()
    const [moved] = next.splice(from, 1)
    next.splice(clamped, 0, moved)
    tabs = next
    publish()
  },

  /** 关闭其他标签（脏文件先确认） */
  closeOthers(key: string) {
    const rest = tabs.filter((tab) => tab.key !== key)
    const dirty = rest.filter((tab) => tab.dirty)
    if (dirty.length > 0 && !window.confirm(`${dirty.length} 个其他标签有未保存的修改，确定关闭？`)) return
    for (const tab of rest) forceClose(tab.key)
  },

  /** 关闭右侧标签 */
  closeRight(key: string) {
    const index = tabs.findIndex((tab) => tab.key === key)
    if (index < 0) return
    const rest = tabs.slice(index + 1)
    const dirty = rest.filter((tab) => tab.dirty)
    if (dirty.length > 0 && !window.confirm(`${dirty.length} 个右侧标签有未保存的修改，确定关闭？`)) return
    for (const tab of rest) forceClose(tab.key)
  },

  /** 关闭所有已保存的标签（保留脏文件） */
  closeSaved() {
    for (const tab of tabs.filter((item) => !item.dirty && !item.preview)) forceClose(tab.key)
  },

  activate(key: string) {
    if (!models.has(key) && !tabOf(key)) return
    active = key
    syncEditor()
    publish()
  },

  /** 打开一个只读对比标签（Monaco createDiffEditor） */
  async openDiff(left: DiffSide, right: DiffSide) {
    layout.open()
    const monaco = await ensureMonaco()
    if (!monaco) {
      setStatus('error', 'Monaco 未就绪，无法打开对比')
      return
    }

    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const key = `diff:${id}`
    const original = monaco.editor.createModel(left.text, languageOf(left.name), monaco.Uri.parse(`dsv-diff:/${id}/left`))
    const modified = monaco.editor.createModel(right.text, languageOf(right.name), monaco.Uri.parse(`dsv-diff:/${id}/right`))
    diffModels.set(key, { original, modified })

    tabs = [
      ...tabs,
      {
        key,
        path: left.path,
        name: `${left.name} ⇄ ${right.name}`,
        dirty: false,
        readOnly: true,
        size: 0,
        truncated: false,
        kind: 'diff',
        diff: { left, right }
      }
    ]
    active = key
    ensureDiffEditor()
    syncEditor()
    setStatus('ready', null)
    publish()
  },

  /** 当前文件：未保存内容 vs Git HEAD */
  async compareWithHead() {
    const current = workspace.getSnapshot()
    const tab = current.tabs.find((item) => item.key === current.active && item.kind === 'file')
    if (!tab) {
      setStatus('error', '请先打开一个文件，再执行「与 HEAD 比较」')
      return
    }
    const model = models.get(tab.key)
    if (!model) return
    try {
      const head = await api.gitHead(tab.path)
      await workspace.openDiff(
        { path: tab.path, name: `${tab.name} · HEAD`, text: head.exists ? head.text : '' },
        { path: tab.path, name: `${tab.name} · 未保存`, text: model.getValue() }
      )
    } catch (error) {
      setStatus('error', `对比失败：${error instanceof Error ? error.message : String(error)}`)
    }
  },

  /** 当前文件：未保存内容 vs 磁盘内容 */
  async compareWithDisk() {
    const current = workspace.getSnapshot()
    const tab = current.tabs.find((item) => item.key === current.active && item.kind === 'file')
    if (!tab) {
      setStatus('error', '请先打开一个文件，再执行「与磁盘比较」')
      return
    }
    const model = models.get(tab.key)
    if (!model) return
    try {
      const disk = await api.read(tab.path)
      if (disk.binary) {
        setStatus('error', '二进制文件不支持对比')
        return
      }
      await workspace.openDiff(
        { path: tab.path, name: `${tab.name} · 磁盘`, text: disk.text },
        { path: tab.path, name: `${tab.name} · 未保存`, text: model.getValue() }
      )
    } catch (error) {
      setStatus('error', `对比失败：${error instanceof Error ? error.message : String(error)}`)
    }
  },

  /** 比较两个磁盘文件 */
  async compareFiles(leftPath: string, rightPath: string) {
    try {
      const [left, right] = await Promise.all([api.read(leftPath), api.read(rightPath)])
      if (left.binary || right.binary) {
        setStatus('error', '二进制文件不支持对比')
        return
      }
      const nameOf = (path: string) => path.split(/[\\/]/).pop() ?? path
      await workspace.openDiff(
        { path: left.path, name: nameOf(left.path), text: left.text },
        { path: right.path, name: nameOf(right.path), text: right.text }
      )
    } catch (error) {
      setStatus('error', `对比失败：${error instanceof Error ? error.message : String(error)}`)
    }
  },

  async save(key: string) {
    const model = models.get(key)
    const tab = tabOf(key)
    if (!model || !tab || tab.readOnly) return
    setStatus('loading', '保存中…')
    try {
      const result = await api.write(tab.path, model.getValue())
      savedVersion.set(key, model.getAlternativeVersionId())
      baseInfo.set(key, { size: result.size, mtimeMs: result.mtimeMs })
      removeDraft(key)
      tabs = tabs.map((item) => (item.key === key ? { ...item, dirty: false, size: result.size } : item))
      setStatus('ready', `已保存 ${tab.name}`)
      publish()
    } catch (error) {
      setStatus('error', `保存失败：${error instanceof Error ? error.message : String(error)}`)
    }
  },

  /** 保存全部脏标签（只读标签跳过） */
  async saveAll() {
    const dirty = tabs.filter((tab) => tab.dirty && !tab.readOnly)
    for (const tab of dirty) await workspace.save(tab.key)
    if (dirty.length > 0) setStatus('ready', `已保存 ${dirty.length} 个文件`)
  },

  /** 关闭全部标签（有脏文件时确认一次） */
  closeAll() {
    if (tabs.length === 0) return
    const dirty = tabs.filter((tab) => tab.dirty)
    if (dirty.length > 0 && !window.confirm(`${dirty.length} 个文件有未保存的修改，确定全部关闭？`)) return

    for (const tab of tabs) {
      try {
        models.get(tab.key)?.dispose()
      } catch {
        /* ignore */
      }
      const pair = diffModels.get(tab.key)
      if (pair) {
        try {
          pair.original?.dispose()
          pair.modified?.dispose()
        } catch {
          /* ignore */
        }
        diffModels.delete(tab.key)
      }
      models.delete(tab.key)
      savedVersion.delete(tab.key)
      baseInfo.delete(tab.key)
      removeDraft(tab.key)
      const timer = draftTimers.get(tab.key)
      if (timer) window.clearTimeout(timer)
      draftTimers.delete(tab.key)
    }
    tabs = []
    active = null
    syncEditor()
    publish()
  },

  /** 按绝对路径打开（快速打开用） */
  openPath(path: string, name?: string) {
    const fileName = name ?? path.split(/[\\/]/).pop() ?? path
    return workspace.openEntry({ path, name: fileName, dir: false, size: 0, mtimeMs: 0 })
  },

  /** 跳到指定行并居中（搜索结果用） */
  revealLine(line: number) {
    const target = editor
    if (!target) return
    const lineNumber = Math.max(1, Math.round(line))
    try {
      target.setPosition({ lineNumber, column: 1 })
      target.revealLineInCenter(lineNumber)
      target.focus()
    } catch {
      /* ignore */
    }
  },

  close(key: string) {
    const tab = tabOf(key)
    if (!tab) return
    if (secondary && secondary.key === key) {
      secondary = null
      try {
        editor2?.setModel(null)
      } catch {
        /* ignore */
      }
    }
    if (tab.dirty && !window.confirm(`${tab.name} 有未保存的修改，确定关闭？`)) return

    const index = tabs.findIndex((item) => item.key === key)
    const model = models.get(key)
    try {
      model?.dispose()
    } catch {
      /* ignore */
    }
    // diff 标签：两个对比模型一起回收
    const pair = diffModels.get(key)
    if (pair) {
      try {
        pair.original?.dispose()
        pair.modified?.dispose()
      } catch {
        /* ignore */
      }
      diffModels.delete(key)
    }
    models.delete(key)
    savedVersion.delete(key)
    baseInfo.delete(key)
    removeDraft(key)
    const timer = draftTimers.get(key)
    if (timer) window.clearTimeout(timer)
    draftTimers.delete(key)
    tabs = tabs.filter((item) => item.key !== key)

    if (active === key) {
      const next = tabs[Math.min(index, tabs.length - 1)]
      active = next ? next.key : null
    }
    syncEditor()
    publish()
  },

  /** 加载失败后手动重试（点错误提示条） */
  retry() {
    if (monacoRef) return
    if (container) void workspace.attach(container)
    else void ensureMonaco()
  },

  /** 窗口重新可见时补一次布局（display 切换后 Monaco 需要重新量尺寸） */
  relayout() {
    try {
      editor2?.layout()
    } catch {
      /* ignore */
    }
    try {
      editor?.layout()
    } catch {
      /* ignore */
    }
    try {
      diffEditor?.layout()
    } catch {
      /* ignore */
    }
  },

  /** 从速览/隐藏状态回来：补布局并抢回焦点（和切标签同一套时序问题） */
  resume() {
    workspace.relayout()
    focusEditorSoon()
  },

  isEmpty() {
    return tabs.length === 0
  },

  isDarkMode() {
    return isDark()
  }
}
