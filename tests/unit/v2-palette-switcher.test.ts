import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import {
  colorAt, contrast, CREAM, INK_DARK, MIN_CONTRAST, PALETTES, PALETTE_MODES,
  randomColors, resolveNode, withLightness,
} from '@/v2/data/palettes'
import { setPaletteMode, usePalette } from '@/v2/data/paletteStore'
import PaletteMenu from '@/v2/components/PaletteMenu.vue'

/**
 * 调色板控件（用户 2026-10-13：「设置一个按钮控制服务器颜色, 名称为调色板」）。
 * 三种可选配色 + 默认配色，核心不变量是**任何配色下文字都要能看清**。
 */

const SOURCES = {
  // hexo-theme-flatpaper: source/css/_partials/var.styl 的命名色
  flatpaper: ['#f0bd4d', '#ec9b5b', '#6fa9d9', '#9c8feb', '#6fa67c', '#d4716c'],
  // komari-theme-emerald: src/styles/main.css 的语义色（oklch 经画布转 sRGB）
  emerald: ['#00bc7d', '#088cb9', '#f1a029', '#e7000b', '#104e64', '#ffb900'],
}

describe('调色板：三种配色来源正确', () => {
  it('flatpaper 六色与上游 var.styl 的命名色一一对应', () => {
    expect(PALETTES.flatpaper.colors).toEqual(SOURCES.flatpaper)
  })

  it('emerald 六色与上游语义色（oklch → hex）一一对应', () => {
    expect(PALETTES.emerald.colors).toEqual(SOURCES.emerald)
  })

  it('每个配色都是 6 台一色且互不相同', () => {
    for (const [name, def] of Object.entries(PALETTES)) {
      expect(def.colors, `${name} 必须是 6 色`).toHaveLength(6)
      expect(new Set(def.colors).size, `${name} 六色必须互不相同`).toBe(6)
    }
  })

  it('模式清单齐备（默认 + 三种可选）', () => {
    expect(PALETTE_MODES).toEqual(['default', 'flatpaper', 'emerald', 'random'])
  })
})

describe('调色板：文字可读性硬约束（核心不变量）', () => {
  it('三套配色的每一台都能配出 ≥4.5:1 的文字色', () => {
    for (const [name, def] of Object.entries(PALETTES)) {
      for (const c of def.colors) {
        const node = resolveNode(c)
        expect(contrast(node.bg, node.ink), `${name} ${c} 文字对比度不足`).toBeGreaterThanOrEqual(MIN_CONTRAST)
      }
    }
  })

  it('文字与描边明暗相反（否则描边起不到分离作用）', () => {
    for (const def of Object.values(PALETTES)) {
      for (const c of def.colors) {
        const n = resolveNode(c)
        const inkIsDark = contrast(n.ink, '#000000') > contrast(n.ink, '#ffffff')
        const shadowIsDark = contrast(n.shadow, '#000000') > contrast(n.shadow, '#ffffff')
        expect(inkIsDark, `${c} 文字与描边明暗同向`).not.toBe(shadowIsDark)
      }
    }
  })

  it('落在"明度死区"的底色会被推出死区（同色相，肉眼几乎无感）', () => {
    // #845ec2 是实测落在死区里的例子：奶白字 4.10:1、近黑字 3.8:1，两头都不达标
    const before = '#845ec2'
    expect(contrast(before, CREAM)).toBeLessThan(MIN_CONTRAST)
    expect(contrast(before, INK_DARK)).toBeLessThan(MIN_CONTRAST)
    const after = resolveNode(before)
    expect(contrast(after.bg, after.ink), '推出死区后仍不达标').toBeGreaterThanOrEqual(MIN_CONTRAST)
    // 必须只是压暗/提亮，不能换色相：色相角变化应 < 12°
    const hue = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
      let x = 0
      if (d) {
        if (mx === r) x = ((g - b) / d) % 6
        else if (mx === g) x = (b - r) / d + 2
        else x = (r - g) / d + 4
        x *= 60
        if (x < 0) x += 360
      }
      return x
    }
    const dh = Math.abs(hue(before) - hue(after.bg))
    expect(Math.min(dh, 360 - dh), '压暗后色相偏了').toBeLessThan(12)
  })

  it('withLightness 只改明度：纯黑/纯白不被染色', () => {
    expect(withLightness('#000000', 0.5)).toBe('#000000')
    expect(withLightness('#ffffff', 1.5)).toBe('#ffffff')
  })

  it('随机的每一批都满足：6 台互不相同 + 全部可读', () => {
    for (let round = 0; round < 40; round++) {
      const list = randomColors()
      expect(list).toHaveLength(6)
      expect(new Set(list).size, `第 ${round} 批出现重复色`).toBe(6)
      for (const c of list) {
        const n = resolveNode(c)
        expect(contrast(n.bg, n.ink), `第 ${round} 批 ${c} 不可读`).toBeGreaterThanOrEqual(MIN_CONTRAST)
      }
    }
  })
})

describe('调色板：状态与持久化', () => {
  beforeEach(() => {
    localStorage.clear()
    setPaletteMode('default')
  })

  it('默认是 default', () => {
    expect(usePalette().mode.value).toBe('default')
  })

  it('切换后写入 localStorage 并能读回', () => {
    setPaletteMode('emerald')
    expect(localStorage.getItem('vk-palette-mode')).toBe('emerald')
    setPaletteMode('flatpaper')
    expect(localStorage.getItem('vk-palette-mode')).toBe('flatpaper')
  })

  it('非法值被忽略（不会把状态写坏）', () => {
    setPaletteMode('emerald')
    setPaletteMode('nonsense' as never)
    expect(usePalette().mode.value).toBe('emerald')
  })

  it('每台的颜色随模式变化，且始终是 6 台', () => {
    const p = usePalette()
    setPaletteMode('default')
    const a = p.nodeColors.value.map((c) => c.bg)
    setPaletteMode('emerald')
    const b = p.nodeColors.value.map((c) => c.bg)
    expect(a).toHaveLength(6)
    expect(b).toHaveLength(6)
    expect(a).not.toEqual(b)
  })

  it('名牌贴图只在默认配色下显示（贴图颜色烘死，动态配色跟不上）', () => {
    const p = usePalette()
    setPaletteMode('default')
    expect(p.showArt.value).toBe(true)
    setPaletteMode('random')
    expect(p.showArt.value).toBe(false)
  })

  it('colorAt 对超出 6 台的索引取模（不会越界）', () => {
    expect(colorAt('emerald', 6)).toBe(PALETTES.emerald.colors[0])
    expect(colorAt('emerald', 7)).toBe(PALETTES.emerald.colors[1])
  })
})

describe('调色板控件：按钮 + 菜单', () => {
  it('按钮文案是「调色板」', () => {
    const w = mount(PaletteMenu)
    expect(w.find('button').text()).toContain('调色板')
  })

  it('菜单默认收起，点击后展开且列出全部模式', async () => {
    const w = mount(PaletteMenu)
    expect(w.find('.vk-palette-menu').exists()).toBe(false)
    await w.find('button').trigger('click')
    const items = w.findAll('.vk-palette-item')
    expect(items).toHaveLength(4)
    const labels = items.map((i) => i.text())
    expect(labels.join('|')).toContain('随机颜色')
    expect(labels.join('|')).toContain('komari-theme-emerald')
    expect(labels.join('|')).toContain('hexo-theme-flatpaper')
  })

  it('点选某一项会切模式并收起菜单', async () => {
    localStorage.clear()
    const w = mount(PaletteMenu)
    await w.find('button').trigger('click')
    const items = w.findAll('.vk-palette-item')
    await items[1].trigger('click')
    expect(usePalette().mode.value).toBe('flatpaper')
    expect(w.find('.vk-palette-menu').exists()).toBe(false)
  })

  it('随机模式下出现「换一批」按钮', async () => {
    localStorage.clear()
    setPaletteMode('random')
    const w = mount(PaletteMenu)
    await w.find('button').trigger('click')
    expect(w.find('.vk-palette-reroll').exists()).toBe(true)
  })
})
