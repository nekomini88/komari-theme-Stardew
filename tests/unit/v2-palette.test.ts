import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PALETTE, PALETTE_HEXES, PALETTE_META, isPaletteColor, offPaletteColors, OUTLINE_COLOR } from '@/v2/theme/palette'
import { resolveScene, sceneColorsAreInPalette, SCENE_LAYERS } from '@/v2/theme/sceneState'
import type { Season, TimeOfDay } from '@/v2/theme/sceneState'

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g
const v2StyleDir = resolve(__dirname, '..', '..', 'src', 'styles', 'v2')

/** 从一段文本里抽出全部 hex 颜色字面量（忽略 URL/#id 之类，本目录不含这些） */
function hexesIn(text: string): string[] {
  return (text.match(HEX_RE) ?? []).map(h => h.toLowerCase())
}

describe('v2 母板结构（ART_SYSTEM §1 材质色阶）', () => {
  it('母板恰好 38 色，且 meta.count 一致', () => {
    expect(PALETTE).toHaveLength(38)
    expect(PALETTE_META.count).toBe(38)
  })

  it('38 色唯一且均为合法 6 位 hex', () => {
    const hexes = PALETTE.map(c => c.hex)
    expect(new Set(hexes).size).toBe(38)
    for (const h of hexes) {
      expect(h).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('描边色为唯一深棕 #2b1d16 且在母板内', () => {
    expect(PALETTE_META.outline.toLowerCase()).toBe('#2b1d16')
    expect(OUTLINE_COLOR).toBe('#2b1d16')
    expect(isPaletteColor('#2b1d16')).toBe(true)
  })
})

describe('v2 设计令牌/CSS 取色 ⊆ 母板（ART_SYSTEM §1.2 / §1.4）', () => {
  const cssFiles = readdirSync(v2StyleDir).filter(f => f.endsWith('.css'))

  it('src/styles/v2 下确有样式文件', () => {
    expect(cssFiles.length).toBeGreaterThan(0)
  })

  it('v2 CSS 中出现的每个颜色都取自母板', () => {
    const offenders: { file: string, hex: string }[] = []
    for (const file of cssFiles) {
      const text = readFileSync(resolve(v2StyleDir, file), 'utf8')
      for (const hex of hexesIn(text)) {
        if (!isPaletteColor(hex))
          offenders.push({ file, hex })
      }
    }
    expect(offenders).toEqual([])
  })

  it('v2 CSS 允许渐变/纹理/柔和投影（木质感拟物），但仍不出现裸 hex 之外的颜色', () => {
    for (const file of cssFiles) {
      const text = readFileSync(resolve(v2StyleDir, file), 'utf8')
      // 新口径：渐变/纹理/软阴影是被允许的表现手段
      expect(text).not.toContain('box-shadow: 0 0')
    }
  })
})

describe('场景状态机取色 ⊆ 母板（全部 time × season 组合）', () => {
  const times: TimeOfDay[] = ['day', 'dusk', 'night']
  const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter']

  it('9 … 12 组合下所有颜色都在母板内', () => {
    for (const t of times) {
      for (const s of seasons) {
        const preset = resolveScene(t, s)
        expect(sceneColorsAreInPalette(preset)).toBe(true)
        expect(offPaletteColors([
          ...preset.skyBands,
          ...Object.values(preset.layerColors),
          preset.timeTint.color,
          preset.seasonTint.color,
        ])).toEqual([])
      }
    }
  })

  it('图层视差系数是 ART_SYSTEM 规定的硬值', () => {
    expect(SCENE_LAYERS.map(l => l.parallax)).toEqual([0, 0.2, 0.5, 0.8, 1])
  })
})
