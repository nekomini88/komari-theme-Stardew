import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import {
  contrast, CREAM, DEFAULT_MODE, INK_DARK, MIN_CONTRAST, nodeColorAt,
  PALETTES, PALETTE_MODES, relLum, SLOT_COUNT,
} from '@/v2/data/palettes'
import { setPaletteMode, usePalette } from '@/v2/data/paletteStore'
import PaletteMenu from '@/v2/components/PaletteMenu.vue'

const ROOT = resolve(__dirname, '..', '..')
const v2StyleDir = resolve(ROOT, 'src/styles/v2')

/**
 * 卡片外观（用户 2026-10-13 定稿）：
 *   目前只有 flatpaper 一种（纸卡 + hexo-theme-flatpaper 六色）。
 *   用户后续口径：「调色板去除玻璃选项」+「保留按钮，菜单里只显示 flatpaper 一项（占位，以后再加配色）」。
 *   ⇒ 玻璃那套（材质切换 / 玻璃卡样式 / 玻璃专用色 / 场景按材质隐藏）已整套删除，不留死代码；
 *     "模式 + 持久化"的机械保留，作为以后加配色的落点。
 */

describe('外观：目前只有 flatpaper 一种', () => {
  it('模式清单只剩 flatpaper，且默认就是它', () => {
    expect(PALETTE_MODES).toEqual(['flatpaper'])
    expect(DEFAULT_MODE).toBe('flatpaper')
  })

  it('玻璃相关的东西不该再存在（材质分支 / 玻璃专用色）', () => {
    // 只查**代码**：注释里保留沿革说明是允许的（不然等于禁止记录历史）
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const pal = strip(readFileSync(resolve(ROOT, 'src/v2/data/palettes.ts'), 'utf8'))
    expect(pal, 'palettes.ts 又出现玻璃模式了').not.toContain('emerald')
    expect(pal, 'palettes.ts 又出现材质分支了').not.toContain('Material')
    const tokens = strip(readFileSync(resolve(v2StyleDir, 'tokens.css'), 'utf8'))
    expect(tokens, '玻璃专用文字色未清干净').not.toContain('--vk-glass-ink')
    const css = strip(readFileSync(resolve(v2StyleDir, 'palette.css'), 'utf8'))
    expect(css, '玻璃卡样式未清干净').not.toContain('backdrop-filter')
    // App 不再按材质隐藏场景（玻璃模式才需要那么做）
    const app = strip(readFileSync(resolve(ROOT, 'src/App.vue'), 'utf8'))
    expect(app, '场景又被按材质条件渲染了').not.toMatch(/SceneStack\s+v-if/)
    expect(app, '根节点不该再挂 data-material').not.toContain('data-material')
  })
})

describe('flatpaper：六色取自 hexo-theme-flatpaper，文字看得清', () => {
  it('六色 = 上游 var.styl 的命名色', () => {
    expect(PALETTES.flatpaper.colors).toEqual([
      '#f0bd4d', '#ec9b5b', '#6fa9d9', '#9c8feb', '#6fa67c', '#d4716c',
    ])
    // 旧那套「站点原参考稿六色」必须整套撤除，不得残留
    for (const gone of ['#279a06', '#06509a', '#53069a', '#9a0623', '#9a5d06', '#048d89'])
      expect(PALETTES.flatpaper.colors, `旧色 ${gone} 又回来了`).not.toContain(gone)
  })

  it('六台各一色且互不相同', () => {
    expect(PALETTES.flatpaper.colors).toHaveLength(SLOT_COUNT)
    expect(new Set(PALETTES.flatpaper.colors).size).toBe(SLOT_COUNT)
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

  it('深字是近黑（不是浅色字）', () => {
    expect(relLum(INK_DARK)).toBeLessThan(0.02)
  })

  it('nodeColorAt 按台取色、超出 6 台取模不越界', () => {
    expect(nodeColorAt('flatpaper', 1).bg).toBe(PALETTES.flatpaper.colors[1])
    expect(nodeColorAt('flatpaper', 6).bg).toBe(PALETTES.flatpaper.colors[0])
  })
})

describe('状态与持久化（为以后加配色留的机械）', () => {
  beforeEach(() => {
    localStorage.clear()
    setPaletteMode(DEFAULT_MODE)
  })

  it('默认 flatpaper，六台配色各不相同', () => {
    const p = usePalette()
    expect(p.mode.value).toBe('flatpaper')
    expect(new Set(p.nodeColors.value.map((c) => c.bg)).size).toBe(SLOT_COUNT)
  })

  it('选择写入 localStorage 并能读回', () => {
    setPaletteMode('flatpaper')
    expect(localStorage.getItem('vk-palette-mode')).toBe('flatpaper')
  })

  it('已废弃的历史值（default / random / emerald）一律回落到默认，不会把状态写坏', () => {
    for (const stale of ['default', 'random', 'emerald', 'nonsense'])
      setPaletteMode(stale as never)
    expect(usePalette().mode.value).toBe('flatpaper')
  })

  it('浏览器里残存的废弃值会被规整成默认（不留废值）', async () => {
    localStorage.setItem('vk-palette-mode', 'emerald')
    vi.resetModules()
    const fresh = await import('@/v2/data/paletteStore')
    expect(fresh.usePalette().mode.value).toBe('flatpaper')
    expect(localStorage.getItem('vk-palette-mode')).toBe('flatpaper')
  })

  it('options 只暴露一项', () => {
    expect(usePalette().options.map((o) => o.mode)).toEqual(['flatpaper'])
  })
})

describe('调色板控件：按钮保留为占位（用户明确要求）', () => {
  it('按钮文案是「调色板」', () => {
    expect(mount(PaletteMenu).find('button').text()).toContain('调色板')
  })

  it('菜单默认收起，展开后只有 flatpaper 一项', async () => {
    const w = mount(PaletteMenu)
    expect(w.find('.vk-palette-menu').exists()).toBe(false)
    await w.find('button').trigger('click')
    const items = w.findAll('.vk-palette-item')
    expect(items).toHaveLength(1)
    expect(items[0]!.text()).toContain('flatpaper')
    // 玻璃/随机都不该再出现
    expect(items.map((i) => i.text()).join('|')).not.toMatch(/玻璃|emerald|随机/)
  })

  it('点选后收起菜单（且状态仍是 flatpaper）', async () => {
    localStorage.clear()
    const w = mount(PaletteMenu)
    await w.find('button').trigger('click')
    await w.findAll('.vk-palette-item')[0]!.trigger('click')
    expect(usePalette().mode.value).toBe('flatpaper')
    expect(w.find('.vk-palette-menu').exists()).toBe(false)
  })
})
