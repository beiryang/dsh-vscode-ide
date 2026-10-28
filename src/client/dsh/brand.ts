/** 产品显示名（设置页分区、左侧入口按钮共用同一处，避免多处写死）。 */

export const DISPLAY_NAME = 'DSH VS Code IDE'
/** 对外显示的名字：左侧入口按钮 + DSH 设置页分区 */
export const SHORT_NAME = 'Code Space'
/**
 * 左侧栏列表里的入口名。
 *
 * DSH 会把 label 渲染在入口内容旁边，而入口本身已经是「Code Space」按钮，
 * 再显示一个名字既重复又占宽度。label 不能是空字符串（可能导致入口不被渲染），
 * 所以用零宽空格占位。
 */
export const NAV_LABEL = '\u200B'
