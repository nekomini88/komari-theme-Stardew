/**
 * 调色板（用户 2026-10-13：「设置一个按钮控制服务器颜色, 名称为调色板」）。
 *
 * 三种可选配色 + 默认配色：
 *   default   —— mycolor.space 以基色 #845ec2 生成的 Classy Palette（本主题原配色）
 *   flatpaper —— hexo-theme-flatpaper 的命名色（同是纸感主题，气质最贴）
 *   emerald   —— komari-theme-emerald 的语义色（oklch 经画布转 sRGB 得到 hex）
 *   random    —— 随机生成，但**必须落在可读区间**（见 resolveNode）
 *
 * 核心约束：任何底色都必须能配出 ≥4.5:1 的文字色。
 * 明度上存在一段"死区"——奶白字要求底色很暗、近黑字要求底色够亮，
 * 中间那段两头都不达标（实测 #845ec2 正落在里面）。resolveNode 会把死区里的底色
 * 沿明度推出去（同色相，肉眼几乎无感），保证对比度达标。
 */

export type PaletteMode = 'default' | 'flatpaper' | 'emerald' | 'random'

export interface NodeColor {
  /** 名称那一行的底色 */
  bg: string
  /** 文字色 */
  ink: string
  /** 文字描边（必须与文字明暗相反，否则起不到分离作用） */
  shadow: string
}

export interface PaletteDef {
  label: string
  hint: string
  colors: string[]
}

export const CREAM = '#f7ecd3'
export const INK_DARK = '#101702'
export const SHADOW_DARK = '#2b1d16'
export const MIN_CONTRAST = 4.5

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}

function rgbToHex(rgb: [number, number, number]): string {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

export function relLum(hex: string): number {
  const lin = (v: number): number => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrast(a: string, b: string): number {
  const la = relLum(a)
  const lb = relLum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** rgb → hsv（只用于按明度推拉，不引入依赖） */
function rgbToHsv(rgb: [number, number, number]): [number, number, number] {
  const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  const d = mx - mn
  let h = 0
  if (d !== 0) {
    if (mx === r) h = ((g - b) / d) % 6
    else if (mx === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
    if (h < 0) h += 1
  }
  return [h, mx === 0 ? 0 : d / mx, mx]
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  const mod = ((i % 6) + 6) % 6
  const table: [number, number, number][] = [
    [v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q],
  ]
  return table[mod]!.map((x) => x * 255) as [number, number, number]
}

/** 只改明度、保持色相与饱和度（压暗/提亮都走这条路，避免偏色） */
export function withLightness(hex: string, factor: number): string {
  const [h, s, v] = rgbToHsv(hexToRgb(hex))
  return rgbToHex(hsvToRgb(h, s, Math.max(0, Math.min(1, v * factor))))
}

/**
 * 给一个底色挑可读的文字色与相反明暗的描边。
 * 底色落在"死区"（两头都 <4.5:1）时，沿明度把它推到能过线的一侧，返回推过的底色。
 */
export function resolveNode(bg: string): NodeColor {
  const inkDark = { ink: INK_DARK, shadow: CREAM }
  const inkCream = { ink: CREAM, shadow: SHADOW_DARK }

  const cd = contrast(bg, INK_DARK)
  const cc = contrast(bg, CREAM)
  if (cd >= MIN_CONTRAST || cc >= MIN_CONTRAST) {
    return cd >= cc ? { bg, ...inkDark } : { bg, ...inkCream }
  }
  // 死区：往对比度更高的方向推明度，直到過线（同色相）
  const wantDarkInk = cd > cc
  let cur = bg
  for (let i = 1; i <= 40; i++) {
    cur = withLightness(bg, wantDarkInk ? 1 + i * 0.03 : 1 - i * 0.03)
    const ok = wantDarkInk ? contrast(cur, INK_DARK) : contrast(cur, CREAM)
    if (ok >= MIN_CONTRAST) break
  }
  return wantDarkInk ? { bg: cur, ...inkDark } : { bg: cur, ...inkCream }
}

export const PALETTES: Record<Exclude<PaletteMode, 'random'>, PaletteDef> = {
  default: {
    label: '默认（mycolor.space）',
    hint: '基色 #845ec2 生成的 Classy Palette',
    colors: ['#7956b2', '#d65db1', '#ff6f91', '#ff9671', '#ffc75f', '#f9f871'],
  },
  flatpaper: {
    label: 'hexo-theme-flatpaper',
    hint: '取自 Homulilly/hexo-theme-flatpaper 的命名色',
    colors: ['#f0bd4d', '#ec9b5b', '#6fa9d9', '#9c8feb', '#6fa67c', '#d4716c'],
  },
  emerald: {
    label: 'komari-theme-emerald',
    hint: '取自 Tokinx/komari-theme-emerald 的语义色（oklch → sRGB）',
    colors: ['#00bc7d', '#088cb9', '#f1a029', '#e7000b', '#104e64', '#ffb900'],
  },
}

const SLOT_COUNT = 6

/**
 * 随机配色：色相均分不重复（保证六台彼此好区分），
 * 明度直接落在可过线的一侧（不靠 resolveNode 事后救），再统一 resolveNode 兜底。
 */
export function randomColors(rand: () => number = Math.random): string[] {
  const start = rand() * 360
  const out: string[] = []
  const taken = new Set<string>()
  // 色相均分保证基调分散；抖动与 resolveNode 的明度推拉都可能造成撞色，故最后去重
  for (let attempt = 0; out.length < SLOT_COUNT && attempt < 60; attempt++) {
    const i = out.length
    const hue = (start + (360 / SLOT_COUNT) * i + (rand() * 24 - 12) + attempt * 7) % 360
    const s = 0.45 + rand() * 0.45
    // 一半暗底配奶白字、一半亮底配近黑字，避开中间死区
    const dark = rand() < 0.5
    const v = dark ? 0.32 + rand() * 0.3 : 0.72 + rand() * 0.26
    const bg = resolveNode(rgbToHex(hsvToRgb(hue / 360, s, v))).bg
    if (taken.has(bg)) continue
    taken.add(bg)
    out.push(bg)
  }
  return out
}

/** 取某模式下台 i（0 起）的颜色；随机模式由调用方传入已生成的色表 */
export function colorAt(mode: PaletteMode, index: number, randomList?: string[]): string {
  if (mode === 'random') {
    const list = randomList && randomList.length ? randomList : randomColors()
    return list[index % list.length] ?? INK_DARK
  }
  const def = PALETTES[mode]
  return def.colors[index % def.colors.length] ?? INK_DARK
}

export const PALETTE_MODES: PaletteMode[] = ['default', 'flatpaper', 'emerald', 'random']
