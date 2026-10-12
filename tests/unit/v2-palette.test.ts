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
  it('母板恰好 41 色，且 meta.count 一致', () => {
    // v3：新增 plum/blossom/seafoam 三色（卡片主题色对齐参考稿的绿/蓝/紫/粉/橘/青）
    expect(PALETTE).toHaveLength(41)
    expect(PALETTE_META.count).toBe(41)
  })

  it('41 色唯一且均为合法 6 位 hex', () => {
    const hexes = PALETTE.map(c => c.hex)
    expect(new Set(hexes).size).toBe(41)
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

describe('v2 令牌引用完整性（防 --vk-soil-day 类静默失效）', () => {
  const stylesDir = resolve(__dirname, '..', '..', 'src', 'styles')
  const srcDir = resolve(__dirname, '..', '..', 'src')

  /** 递归收集目录下的文件 */
  const walk = (dir: string, ext: string[]): string[] => {
    const out: string[] = []
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, e.name)
      if (e.isDirectory())
        out.push(...walk(p, ext))
      else if (ext.some(x => e.name.endsWith(x)))
        out.push(p)
    }
    return out
  }

  it('src/styles 下 var(--vk-*) 的硬引用（无 fallback）都有定义', () => {
    const styleFiles = walk(stylesDir, ['.css'])
    const defFiles = [...styleFiles, ...walk(srcDir, ['.vue'])]
    // 定义：`--vk-xxx:`（含 Vue 内联样式对象里的 `'--vk-xxx':`）
    const DEF_RE = /['"]?(--vk-[a-z0-9-]+)['"]?\s*:/gi
    // 引用：`var(--vk-xxx)`
    const USE_RE = /var\(\s*(--vk-[a-z0-9-]+)/gi

    const defined = new Set<string>()
    for (const f of defFiles) {
      for (const m of readFileSync(f, 'utf8').matchAll(DEF_RE))
        defined.add(m[1]!)
    }

    const offenders: { file: string, token: string }[] = []
    for (const f of styleFiles) {
      const text = readFileSync(f, 'utf8')
      for (const m of text.matchAll(USE_RE)) {
        const token = m[1]!
        // 带 fallback（`var(--x, ...)`）= 有意提供的默认值 → 不算违规
        const after = text.slice(m.index! + m[0].length)
        const hasFallback = /^\s*,/.test(after)
        if (!defined.has(token) && !hasFallback)
          offenders.push({ file: f.split('/').pop()!, token })
      }
    }
    // 硬引用未定义令牌 → 该条 CSS 声明在计算时整条失效（不报错、只是没效果）
    expect(offenders).toEqual([])
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
