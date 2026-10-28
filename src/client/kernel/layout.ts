/**
 * 壳的布局状态：开关、是否最大化、几何。
 *
 * 只存在 localStorage（`dsv:layout.v1`），带版本号 + 迁移入口；
 * 插件被卸载时用户数据不会被别的插件误读，重新装上还能恢复现场。
 */

export type Rect = { x: number; y: number; w: number; h: number }

export type LayoutState = {
  open: boolean
  max: boolean
  rect: Rect
  /**
   * 速览：临时把工作台藏起来看 DSH（不关闭、不丢状态），再按一次回来。
   * 刻意不写 localStorage —— 重启后不该是「藏起来」的状态。
   */
  peek: boolean
}

const KEY = 'dsv:layout.v1'
export const SCHEMA_VERSION = 1
export const MIN_W = 720
export const MIN_H = 460
/**
 * 最大化时顶部必须留出的安全带（px）。
 *
 * DSH 的标题栏 + 系统窗口按钮都在屏幕最上面这一条里。我们的窗口是自挂 body 层的
 * 浮层，如果最大化时盖住这条，会出现两个致命后果：
 *   1. 我们的 ✕ 正好压在系统窗口按钮下面 → 关不掉自己
 *   2. DSH 被完全遮住 → 也没法操作 DSH
 * 所以最大化只占「安全带以下」的区域，保证任何时刻都能退出。
 */
export const SAFE_TOP = 44

function viewport() {
  return { w: window.innerWidth, h: window.innerHeight }
}

export function defaultRect(): Rect {
  const v = viewport()
  const w = Math.min(Math.max(MIN_W, Math.round(v.w * 0.88)), Math.max(MIN_W, v.w - 24))
  const h = Math.min(Math.max(MIN_H, Math.round(v.h * 0.82)), Math.max(MIN_H, v.h - 24))
  return { x: Math.round((v.w - w) / 2), y: Math.round((v.h - h) / 2), w, h }
}

/** 至少保留 160px 横向、44px（标题栏）纵向在屏幕内，避免拖丢 */
export function clampRect(rect: Rect): Rect {
  const v = viewport()
  const w = Math.min(Math.max(Math.round(rect.w), MIN_W), Math.max(MIN_W, v.w - 24))
  const h = Math.min(Math.max(Math.round(rect.h), MIN_H), Math.max(MIN_H, v.h - 24))
  const x = Math.min(Math.max(Math.round(rect.x), -w + 160), Math.max(0, v.w - 160))
  const y = Math.min(Math.max(Math.round(rect.y), 0), Math.max(0, v.h - 44))
  return { x, y, w, h }
}

function load(): LayoutState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { v?: number; open?: boolean; max?: boolean; rect?: Rect }
      if (parsed && parsed.v === SCHEMA_VERSION) {
        const rect = parsed.rect && typeof parsed.rect.w === 'number' ? clampRect(parsed.rect) : defaultRect()
        return { open: parsed.open === true, max: parsed.max === true, rect, peek: false }
      }
      // 未来版本在这里做迁移；认不出的数据直接回落默认值，不抛错
    }
  } catch {
    /* 存储不可用时用内存值继续跑 */
  }
  return { open: false, max: false, rect: defaultRect(), peek: false }
}

let state: LayoutState = load()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: SCHEMA_VERSION, ...state }))
  } catch {
    /* 忽略配额/隐私模式失败 */
  }
}

function emit() {
  for (const listener of listeners) listener()
}

function patch(next: Partial<LayoutState>, write = true) {
  state = { ...state, ...next }
  if (write) persist()
  emit()
}

export const layout = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot(): LayoutState {
    return state
  },
  open() {
    patch({ open: true, peek: false })
  },
  close() {
    patch({ open: false, peek: false })
  },
  toggle() {
    patch({ open: !state.open, peek: false })
  },
  /** 速览：藏起工作台看 DSH，再按一次原样回来（状态全保留） */
  togglePeek() {
    if (!state.open) {
      patch({ open: true, peek: false })
      return
    }
    patch({ peek: !state.peek }, false)
  },
  setMax(max: boolean) {
    patch({ max })
  },
  /** 拖动/缩放过程中不写盘，松手时再 commit，避免每帧 stringify */
  previewRect(rect: Rect) {
    patch({ rect: clampRect(rect) }, false)
  },
  commit() {
    persist()
  },
  resetGeometry() {
    patch({ rect: defaultRect(), max: false })
  },
  reflow() {
    if (!state.rect) return
    patch({ rect: clampRect(state.rect) }, false)
  }
}
