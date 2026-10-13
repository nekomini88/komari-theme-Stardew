import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import {
  contrast, CREAM, DEFAULT_MODE, GLASS_INK, hexToRgb, INK_DARK, MIN_CONTRAST, nodeColorAt,
  PALETTES, PALETTE_MODES, relLum, SLOT_COUNT,
} from '@/v2/data/palettes'
import { setPaletteMode, usePalette } from '@/v2/data/paletteStore'
import PaletteMenu from '@/v2/components/PaletteMenu.vue'

const ROOT = resolve(__dirname, '..', '..')
const v2StyleDir = resolve(ROOT, 'src/styles/v2')

/**
 * 卡片外观控件（用户 2026-10-13 定稿）：
 *   flatpaper —— 奶白纸卡 + 六台各一色（默认）
 *   emerald   —— 玻璃透明卡（对齐参考站 komari.vickypig.com 的实测配方）
 * 只留这两种；此前那套「四套配色 + 随机」已废弃。
 */

/** 把 sRGB 与 alpha 合成到给定底上（用于验证玻璃卡的文字可读性） */
function over(fg: [number, number, number], alpha: number, bg: [number, number, number]): string {
  const mix = fg.map((v, i) => Math.round(v * alpha + (bg[i] ?? 0) * (1 - alpha)))
  return '#' + mix.map((v) => v.toString(16).padStart(2, '0')).join('')
}

describe('外观：只剩两种，且默认是纸卡', () => {
  it('模式清单 = flatpaper / emerald', () => {
    expect(PALETTE_MODES).toEqual(['flatpaper', 'emerald'])
    expect(DEFAULT_MODE).toBe('flatpaper')
  })

  it('flatpaper：奶白纸卡 + 六台各一色（6 色互不相同）', () => {
    const def = PALETTES.flatpaper
    expect(def.material).toBe('paper')
    expect(def.colors).toHaveLength(SLOT_COUNT)
    expect(new Set(def.colors).size).toBe(SLOT_COUNT)
  })

  it('emerald：玻璃材质且无色（"玻璃是透明无色场景"）', () => {
    const def = PALETTES.emerald
    expect(def.material).toBe('glass')
    expect(def.colors).toEqual([])
  })
})

describe('纸卡：参考稿固定配对，文字看得清', () => {
  it('六色 = hexo-theme-flatpaper 的命名色（用户：flat-paper 用项目自己的颜色，默认那套不要了）', () => {
    // 取自上游 source/css/_partials/var.styl：--yellow / --orange / --blue / --violet / --green / --red
    expect(PALETTES.flatpaper.colors).toEqual([
      '#f0bd4d', '#ec9b5b', '#6fa9d9', '#9c8feb', '#6fa67c', '#d4716c',
    ])
    // 旧那套「站点原参考稿六色」必须整套撤除，不得残留
    for (const gone of ['#279a06', '#06509a', '#53069a', '#9a0623', '#9a5d06', '#048d89'])
      expect(PALETTES.flatpaper.colors, `旧色 ${gone} 又回来了`).not.toContain(gone)
  })

  it('配对 = 深字 + 浅描边（新六色偏亮），对比度每台 ≥4.5:1', () => {
    const pairs = PALETTES.flatpaper.pairs ?? []
    expect(pairs).toHaveLength(SLOT_COUNT)
    for (const [i, p] of pairs.entries()) {
      expect(p.bg).toBe(PALETTES.flatpaper.colors[i])
      expect(p.ink).toBe(INK_DARK)
      expect(p.shadow).toBe(CREAM)
      expect(contrast(p.bg, p.ink), `第 ${i + 1} 台对比度不足`).toBeGreaterThanOrEqual(MIN_CONTRAST)
    }
  })

  it('文字与描边明暗相反（否则描边起不到分离作用）', () => {
    for (const p of PALETTES.flatpaper.pairs ?? []) {
      const inkDark = contrast(p.ink, '#000000') > contrast(p.ink, '#ffffff')
      const shadowDark = contrast(p.shadow, '#000000') > contrast(p.shadow, '#ffffff')
      expect(inkDark).not.toBe(shadowDark)
    }
  })

  it('nodeColorAt 按台取色、超出 6 台取模不越界', () => {
    expect(nodeColorAt('flatpaper', 1).bg).toBe(PALETTES.flatpaper.colors[1])
    expect(nodeColorAt('flatpaper', 6).bg).toBe(PALETTES.flatpaper.colors[0])
  })
})

describe('玻璃卡：无色，但信息必须看得清', () => {
  it('玻璃模式不着台色：底色透明 + 近黑字', () => {
    const n = nodeColorAt('emerald', 0)
    expect(n.bg).toBe('transparent')
    expect(n.ink).toBe(GLASS_INK)
    // 无色 ⇒ 六台取到的配色完全一致
    for (let i = 0; i < SLOT_COUNT; i++) expect(nodeColorAt('emerald', i)).toEqual(n)
  })

  it('玻璃文字色是近黑（参考站口径）', () => {
    expect(relLum(GLASS_INK)).toBeLessThan(0.02)
  })

  it('玻璃卡在"最暗的场景"下文字仍 ≥4.5:1', () => {
    // 参考站配方：底色 = 白 50%（+ blur）。玻璃后面是本站时间场景，
    // 最坏情况是夜景（近黑）。取纯黑作最暗底来算下界。
    const glassOnBlack = over([255, 255, 255], 0.5, [0, 0, 0])
    expect(contrast(glassOnBlack, GLASS_INK)).toBeGreaterThanOrEqual(MIN_CONTRAST)
    // 白天亮场景
    const glassOnWhite = over([255, 255, 255], 0.5, [255, 255, 255])
    expect(contrast(glassOnWhite, GLASS_INK)).toBeGreaterThanOrEqual(MIN_CONTRAST)
  })

  it('旧的深棕正文色在玻璃上确实不达标（说明这个覆盖是必要的）', () => {
    const glassOnBlack = over([255, 255, 255], 0.5, [0, 0, 0])
    const oldInk = '#55392a'
    expect(hexToRgb(oldInk)).toHaveLength(3)
    expect(contrast(glassOnBlack, oldInk)).toBeLessThan(MIN_CONTRAST)
  })
})

describe('状态与持久化', () => {
  beforeEach(() => {
    localStorage.clear()
    setPaletteMode(DEFAULT_MODE)
  })

  it('默认 flatpaper、材质是纸卡、显示名牌贴图', () => {
    const p = usePalette()
    expect(p.mode.value).toBe('flatpaper')
    expect(p.material.value).toBe('paper')
    expect(p.showArt.value).toBe(true)
  })

  it('切到 emerald：材质变玻璃、不再显示名牌贴图', () => {
    const p = usePalette()
    setPaletteMode('emerald')
    expect(p.material.value).toBe('glass')
    expect(p.showArt.value).toBe(false)
  })

  it('选择写入 localStorage 并能读回', () => {
    setPaletteMode('emerald')
    expect(localStorage.getItem('vk-palette-mode')).toBe('emerald')
  })

  it('已废弃的历史值（default / random）会被回落成默认，不会把状态写坏', () => {
    setPaletteMode('default' as never)
    expect(usePalette().mode.value).toBe('flatpaper')
    setPaletteMode('random' as never)
    expect(usePalette().mode.value).toBe('flatpaper')
    setPaletteMode('nonsense' as never)
    expect(usePalette().mode.value).toBe('flatpaper')
  })

  it('六台的配色随模式变化：纸卡是六色、玻璃只有一种', () => {
    const p = usePalette()
    const paper = p.nodeColors.value.map((c) => c.bg)
    expect(new Set(paper).size).toBe(SLOT_COUNT)
    setPaletteMode('emerald')
    expect(new Set(p.nodeColors.value.map((c) => c.bg)).size).toBe(1)
  })

  it('options 只暴露两项，且带材质标记', () => {
    expect(usePalette().options.map((o) => o.mode)).toEqual(['flatpaper', 'emerald'])
    expect(usePalette().options.map((o) => o.material)).toEqual(['paper', 'glass'])
  })
})

describe('调色板控件：按钮 + 菜单', () => {
  it('按钮文案是「调色板」', () => {
    expect(mount(PaletteMenu).find('button').text()).toContain('调色板')
  })

  it('菜单默认收起，点击后展开且只有两项', async () => {
    const w = mount(PaletteMenu)
    expect(w.find('.vk-palette-menu').exists()).toBe(false)
    await w.find('button').trigger('click')
    const items = w.findAll('.vk-palette-item')
    expect(items).toHaveLength(2)
    const text = items.map((i) => i.text()).join('|')
    expect(text).toContain('flatpaper')
    expect(text).toContain('emerald')
    // 随机配色已按用户口径删除，菜单里不应再有它
    expect(text).not.toContain('随机')
  })

  it('点选 emerald 会切模式并收起菜单', async () => {
    localStorage.clear()
    setPaletteMode('flatpaper')
    const w = mount(PaletteMenu)
    await w.find('button').trigger('click')
    await w.findAll('.vk-palette-item')[1]!.trigger('click')
    expect(usePalette().mode.value).toBe('emerald')
    expect(w.find('.vk-palette-menu').exists()).toBe(false)
  })

  it('玻璃项自带材质标记（供样式画半透明示意块）', async () => {
    const w = mount(PaletteMenu)
    await w.find('button').trigger('click')
    const swatches = w.findAll('.vk-palette-swatch')
    expect(swatches[1]!.attributes('data-material')).toBe('glass')
  })
})

describe('玻璃模式：整页不铺背景图（用户：当选择玻璃颜色时, 背景跟参考站一致 不要出现背景图）', () => {
  it('场景图层栈只在纸卡模式渲染', () => {
    const app = readFileSync(resolve(ROOT, 'src/App.vue'), 'utf8')
    expect(app, '场景图层栈必须按材质条件渲染，玻璃模式下不得挂载')
      .toMatch(/<SceneStack v-if="material !== 'glass'"/)
    expect(app, '根节点必须把材质挂出来供样式判断').toContain(':data-material="material"')
  })

  it('玻璃模式整页底色为纯白（参考站实测 oklch(1 0 0)、无背景图）', () => {
    const css = readFileSync(resolve(v2StyleDir, 'palette.css'), 'utf8')
    expect(css, '玻璃模式缺少整页底色规则')
      .toMatch(/\.vk-app\[data-material='glass'\] \{[\s\S]*?background-color: #ffffff/)
  })
})
