/**
 * 卡片外观（用户 2026-10-13 定稿：只留两种）。
 *
 *   flatpaper —— 奶白纸卡 + 六台各一色（默认）。这是站点原本的样子：
 *                "flatpaper 是6色混搭"、"现在的配色就是默认配置保留"。
 *   emerald   —— 玻璃透明卡：对齐参考站 https://komari.vickypig.com/ 的实测配方
 *                （半透明底 + backdrop-filter blur(8px) + 8px 圆角 + 细边框）。
 *                "玻璃是透明无色场景" —— 不着色，让背后的时间场景透出来。
 *
 * 之前那套「四套配色（默认/随机/emerald/flatpaper 各自六色）」已按用户口径废弃：
 * 随机配色整块删掉，不留死代码。
 */

export type PaletteMode = 'flatpaper' | 'emerald'

/** 材质：paper = 奶白纸卡；glass = 玻璃透明卡 */
export type Material = 'paper' | 'glass'

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
  material: Material
  /** 六台色槽（玻璃模式无色，故为空） */
  colors: string[]
  /** 固定配对：参考稿既定美术口径，不做自动挑选（否则浅底会被换成深色字 = 改外观） */
  pairs?: NodeColor[]
}

export const CREAM = '#f7ecd3'
// 注意：CREAM 现在同时充任「浅描边色」——新六色偏亮，配对是深字 + 浅描边（见 SLOT_COLORS 处注释）
export const INK_DARK = '#101702'

/** 玻璃卡上的文字色：对齐参考站的 oklch(0.141 0.005 285.823) ≈ 近黑 */
export const GLASS_INK = '#0b0b0d'
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
    material: 'paper',
    colors: [...SLOT_COLORS],
    // 新六色整体偏亮（亮度 0.30~0.63）⇒ 配对为**深字 + 浅描边**（明暗相反，实测 5.6~10.6:1）
    pairs: SLOT_COLORS.map((bg) => ({ bg, ink: INK_DARK, shadow: CREAM })),
  },
  emerald: {
    label: 'emerald（玻璃）',
    hint: '透明玻璃卡，让背后场景透出来',
    material: 'glass',
    colors: [],
  },
}

export const PALETTE_MODES: PaletteMode[] = ['flatpaper', 'emerald']

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

export function materialOf(mode: PaletteMode): Material {
  return PALETTES[mode].material
}

/**
 * 取某外观下第 i 台（0 起）的名称行配色。
 * 玻璃模式无色 ⇒ 底色透明、文字用玻璃专用近黑色。
 */
export function nodeColorAt(mode: PaletteMode, index: number): NodeColor {
  const def = PALETTES[mode]
  if (def.material === 'glass') {
    return { bg: 'transparent', ink: GLASS_INK, shadow: '#ffffff' }
  }
  const pairs = def.pairs ?? []
  return pairs[index % pairs.length] ?? { bg: SLOT_COLORS[0]!, ink: INK_DARK, shadow: CREAM }
}
