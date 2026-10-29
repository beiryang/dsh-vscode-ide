/** 搜索视图：输入关键词，按文件分组显示命中行，点击跳到对应位置。 */

import * as React from 'react'

import { h } from '../../h'
import { registry, type WorkbenchContext } from '../../kernel/registry'
import { api } from '../../kernel/transport'

type Hit = { path: string; rel: string; line: number; text: string }
type Options = { caseSensitive: boolean; wholeWord: boolean; regex: boolean; include: string; exclude: string }
type Meta = { engine: 'git' | 'walk'; elapsedMs: number; truncated: boolean; scanned?: number }

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlight(text: string, query: string, options: Options): React.ReactNode {
  if (!query) return text
  let pattern: RegExp
  try {
    pattern = new RegExp(options.regex ? query : escapeRegExp(query), options.caseSensitive ? 'g' : 'gi')
  } catch {
    return text
  }
  const parts: React.ReactNode[] = []
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (!match[0]) break
    if (index > cursor) parts.push(text.slice(cursor, index))
    parts.push(h('mark', { key: `${index}` }, match[0]))
    cursor = index + match[0].length
  }
  if (parts.length === 0) return text
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

export function SearchView({ ctx }: { ctx: WorkbenchContext }) {
  const [query, setQuery] = React.useState('')
  const [options, setOptions] = React.useState<Options>({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    include: '',
    exclude: ''
  })
  const [filterOpen, setFilterOpen] = React.useState(false)
  const [hits, setHits] = React.useState<Hit[]>([])
  const [meta, setMeta] = React.useState<Meta | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [replaceOpen, setReplaceOpen] = React.useState(false)
  const [replacement, setReplacement] = React.useState('')
  const [replacing, setReplacing] = React.useState(false)
  const [replaceNote, setReplaceNote] = React.useState<string | null>(null)
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set())
  const [activeHit, setActiveHit] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    const focus = () => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener('dsv:focus-search', focus)
    return () => window.removeEventListener('dsv:focus-search', focus)
  }, [])

  const run = React.useCallback(async () => {
    const value = query.trim()
    if (!value) {
      setHits([])
      setMeta(null)
      setError(null)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await api.searchContent({ query: value, ...options })
      setHits(result.matches)
      setMeta({ engine: result.engine, elapsedMs: result.elapsedMs, truncated: result.truncated, scanned: result.scanned })
      setCollapsed(new Set())
    } catch (cause) {
      setHits([])
      setMeta(null)
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }, [options, query])

  const groups = React.useMemo(() => {
    const map = new Map<string, Hit[]>()
    for (const hit of hits) {
      const list = map.get(hit.rel)
      if (list) list.push(hit)
      else map.set(hit.rel, [hit])
    }
    return [...map.entries()]
  }, [hits])

  const toggleFile = (rel: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(rel)) next.delete(rel)
      else next.add(rel)
      return next
    })
  }

  const openHit = (hit: Hit) => {
    setActiveHit(`${hit.rel}:${hit.line}`)
    const name = hit.path.split(/[\\/]/).pop() ?? hit.rel
    registry.openFile(hit.path, { name, line: hit.line })
  }

  const toggleOption = (key: 'caseSensitive' | 'wholeWord' | 'regex') => {
    setOptions((previous) => ({ ...previous, [key]: !previous[key] }))
  }

  const replaceAll = async () => {
    const value = query.trim()
    if (!value || replacing) return
    if (!window.confirm(`将在 ${groups.length} 个文件中替换 ${hits.length} 处匹配：\n\n${value} → ${replacement || '（删除）'}\n\n确定继续？`)) return
    setReplacing(true)
    setReplaceNote(null)
    try {
      const result = await api.replaceContent({ query: value, replacement, ...options })
      setReplaceNote(`已替换 ${result.replaced} 处，涉及 ${result.filesChanged} 个文件`)
      await run()
    } catch (cause) {
      setReplaceNote(`替换失败：${cause instanceof Error ? cause.message : String(cause)}`)
    } finally {
      setReplacing(false)
    }
  }

  return h(
    'div',
    { className: 'dsv-search' },
    h(
      'div',
      { className: 'dsv-search-bar' },
      h('input', {
        ref: inputRef,
        className: 'dsv-search-input',
        value: query,
        spellCheck: false,
        placeholder: '搜索内容，Enter 执行',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
        onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void run()
          }
        }
      }),
      h(
        'button',
        {
          className: 'dsv-search-toggle',
          title: '区分大小写',
          'data-active': options.caseSensitive ? 'true' : 'false',
          onClick: () => toggleOption('caseSensitive')
        },
        'Aa'
      ),
      h(
        'button',
        {
          className: 'dsv-search-toggle',
          title: '全词匹配',
          'data-active': options.wholeWord ? 'true' : 'false',
          onClick: () => toggleOption('wholeWord')
        },
        'ab'
      ),
      h(
        'button',
        {
          className: 'dsv-search-toggle',
          title: '正则表达式',
          'data-active': options.regex ? 'true' : 'false',
          onClick: () => toggleOption('regex')
        },
        '.*'
      ),
      h(
        'button',
        {
          className: 'dsv-search-toggle',
          title: replaceOpen ? '隐藏替换' : '显示替换',
          'data-active': replaceOpen ? 'true' : 'false',
          onClick: () => setReplaceOpen((previous) => !previous)
        },
        '⇄'
      ),
      h(
        'button',
        {
          className: 'dsv-search-toggle',
          title: '筛选：包含 / 排除（glob，逗号分隔）',
          'data-active': filterOpen || options.include || options.exclude ? 'true' : 'false',
          onClick: () => setFilterOpen((previous) => !previous)
        },
        '⋯'
      )
    ),
    filterOpen
      ? h(
          'div',
          { className: 'dsv-search-replace' },
          h('input', {
            className: 'dsv-search-input',
            value: options.include,
            spellCheck: false,
            placeholder: '包含：如 src/**/*.ts，逗号分隔',
            onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
              setOptions((previous) => ({ ...previous, include: event.target.value }))
          }),
          h('input', {
            className: 'dsv-search-input',
            value: options.exclude,
            spellCheck: false,
            placeholder: '排除：如 **/*.min.js, dist/**',
            onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
              setOptions((previous) => ({ ...previous, exclude: event.target.value }))
          })
        )
      : null,
    replaceOpen
      ? h(
          'div',
          { className: 'dsv-search-replace' },
          h('input', {
            className: 'dsv-search-input',
            value: replacement,
            spellCheck: false,
            placeholder: '替换为…（留空即删除匹配内容）',
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => setReplacement(event.target.value)
          }),
          h(
            'button',
            {
              className: 'dsv-search-replace-btn',
              disabled: replacing || !query.trim() || hits.length === 0,
              title: hits.length === 0 ? '先搜索出结果再替换' : `替换 ${hits.length} 处（${groups.length} 个文件）`,
              onClick: () => void replaceAll()
            },
            replacing ? '替换中…' : '全部替换'
          )
        )
      : null,
    error
      ? h('div', { className: 'dsv-search-meta', 'data-state': 'error' }, error)
      : meta
        ? h(
            'div',
            { className: 'dsv-search-meta' },
            h('span', null, `${meta.engine === 'git' ? 'git grep' : '遍历'} · ${meta.elapsedMs}ms`),
            h('span', null, `${hits.length} 处 / ${groups.length} 个文件`),
            meta.truncated ? h('span', { style: { color: '#d7ba7d' } }, '已截断（结果太多）') : null,
            busy ? h('span', null, '搜索中…') : null
          )
        : null,
    replaceNote ? h('div', { className: 'dsv-search-meta', 'data-state': replaceNote.startsWith('替换失败') ? 'error' : 'info' }, replaceNote) : null,
    h(
      'div',
      { className: 'dsv-search-results' },
      ctx.remote
        ? h('div', { className: 'dsv-search-empty' }, '远程工作区（SFTP）暂不支持内容搜索，请在本地工作区使用。')
        : groups.length === 0
          ? h(
              'div',
              { className: 'dsv-search-empty' },
              busy
                ? '搜索中…'
                : query.trim()
                  ? '没有找到匹配内容。试试放宽选项，或换一个关键词。'
                  : h(
                      React.Fragment,
                      null,
                      h('div', null, '输入关键词后按 Enter 搜索整个工作区。'),
                      h('div', null, 'Aa 区分大小写 · ab 全词 · .* 正则；点击结果跳到对应行。'),
                      h('div', null, 'Ctrl+Alt+Shift+F 随时回到这里。')
                    )
            )
          : groups.map(([rel, list]) =>
              h(
                React.Fragment,
                { key: rel },
                h(
                  'div',
                  { className: 'dsv-search-file', onClick: () => toggleFile(rel), title: rel },
                  h('span', null, collapsed.has(rel) ? '▸' : '▾'),
                  h('span', { className: 'dsv-search-file-path' }, rel),
                  h('span', { className: 'dsv-search-file-count' }, String(list.length))
                ),
                collapsed.has(rel)
                  ? null
                  : list.map((hit) =>
                      h(
                        'div',
                        {
                          key: `${hit.rel}:${hit.line}`,
                          className: 'dsv-search-hit',
                          'data-active': activeHit === `${hit.rel}:${hit.line}` ? 'true' : 'false',
                          onClick: () => openHit(hit)
                        },
                        h('span', { className: 'dsv-search-line' }, String(hit.line)),
                        h('span', { className: 'dsv-search-text' }, highlight(hit.text, query.trim(), options))
                      )
                    )
              )
            )
    )
  )
}
