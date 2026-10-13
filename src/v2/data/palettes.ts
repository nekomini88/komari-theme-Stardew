/**
 * 卡片外观（用户 2026-10-13 定稿：**只剩 flatpaper 一种**）。
 *
 *   flatpaper —— 奶白纸卡 + 六台各一色；六色取自 hexo-theme-flatpaper（见 SLOT_COLORS）。
 *
 * 沿革（都按用户口径删掉了，不留死代码）：
 *   · "四套配色（默认/随机/emerald/flatpaper）" → 收敛为两种 → 随机整块删除；
 *   · 玻璃（emerald）→ 「当选择玻璃颜色时, 背景跟参考站一致 不要出现背景图」→ 随后
 *     「调色板去除玻璃选项」⇒ 玻璃卡样式、玻璃专用色、按材质隐藏场景全部撤除。
 *   保留 `PaletteMode + 持久化` 这套机械，作为以后加配色的落点（用户要求保留按钮做占位）。
 */

export type PaletteMode = 'flatpaper'

export interface NodeColor {
  /** 名称行底色 */
  bg: string
  /** 名称行文字色 */
  ink: string
  /** 名称行描边色（与文字明暗相反，用于像素描边） */
  shadow: string
}

export interface PaletteDef {
  label: string
  hint: string
  /** 六台色槽 */
  colors: string[]
  /** 固定配对：参考稿既定美术口径，不做自动挑选（否则浅底会被换成深色字 = 改外观） */
  pairs?: NodeColor[]
}

export const CREAM = '#f7ecd3'
// 注意：CREAM 现在同时充任「浅描边色」——新六色偏亮，配对是深字 + 浅描边（见 SLOT_COLORS 处注释）
export const INK_DARK = '#101702'

export const MIN_CONTRAST = 4.5

/**
 * 六台色槽 = **hexo-theme-flatpaper 自己的命名色**（用户 2026-10-13：
 * 「flat-paper 是项目 hexo flat-paper 颜色, 默认的颜色不要保留了」）。
 * 取自上游 source/css/_partials/var.styl 的 --yellow / --orange / --blue / --violet / --green / --red。
 * 此前那套「站点原参考稿六色（绿/蓝/紫/红/橙/青）」已按用户口径整套撤除。
 */
const SLOT_COLORS = ['#f0bd4d', '#ec9b5b', '#6fa9d9', '#9c8feb', '#6fa67c', '#d4716c']

export const SLOT_COUNT = SLOT_COLORS.length

export const DEFAULT_MODE: PaletteMode = 'flatpaper'

export const PALETTES: Record<PaletteMode, PaletteDef> = {
  flatpaper: {
    label: 'flatpaper（纸卡 · 六色）',
    hint: '奶白纸卡，六台各一色（默认）',
    colors: [...SLOT_COLORS],
    // 新六色整体偏亮（亮度 0.30~0.63）⇒ 配对为**深字 + 浅描边**（明暗相反，实测 5.6~10.6:1）
    pairs: SLOT_COLORS.map((bg) => ({ bg, ink: INK_DARK, shadow: CREAM })),
  },
}

export const PALETTE_MODES: PaletteMode[] = ['flatpaper']

/* ---------- 可读性工具（供实现与单测共同使用，保证"信息看得清"是可验证的） ---------- */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/** WCAG 相对亮度 */
export function relLum(hex: string): number {
  const lin = (v: number): number => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG 对比度 */
export function contrast(a: string, b: string): number {
  const la = relLum(a)
  const lb = relLum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * 取第 i 台（0 起）的名称行配色。
 * 只有纸卡一种外观了，故不再有"无色"分支。
 */
export function nodeColorAt(mode: PaletteMode, index: number): NodeColor {
  const pairs = PALETTES[mode].pairs ?? []
  return pairs[index % pairs.length] ?? { bg: SLOT_COLORS[0]!, ink: INK_DARK, shadow: CREAM }
}
