/**
 * 母板访问层 —— 48 色母板（src/assets/palette.json）的唯一读取入口。
 * 设计令牌、SceneStack 与素材校验都通过这里取色，保证「取色 ⊆ 母板」可被单测强制。
 */
import paletteData from '@/assets/palette.json'

export interface PaletteEntry {
  id: string
  hex: string
  role: string
}

export interface PaletteMeta {
  name: string
  version: number
  count: number
  outline: string
  notes: string
}

export const PALETTE_META: PaletteMeta = paletteData.meta as PaletteMeta
export const PALETTE: PaletteEntry[] = paletteData.colors as PaletteEntry[]

/** 母板全部颜色（小写 hex） */
export const PALETTE_HEXES: string[] = PALETTE.map(c => c.hex.toLowerCase())

/** 全系统唯一描边色 */
export const OUTLINE_COLOR: string = PALETTE_META.outline.toLowerCase()

/** 按 id 取色，未命中返回 undefined */
export function color(id: string): string | undefined {
  return PALETTE.find(c => c.id === id)?.hex.toLowerCase()
}

/** 判断某 hex 是否取自母板（大小写不敏感） */
export function isPaletteColor(hex: string): boolean {
  return PALETTE_HEXES.includes(hex.toLowerCase())
}

/** 返回给定颜色里不在母板内的那些（用于校验报错） */
export function offPaletteColors(hexes: string[]): string[] {
  return hexes.filter(h => !isPaletteColor(h))
}
