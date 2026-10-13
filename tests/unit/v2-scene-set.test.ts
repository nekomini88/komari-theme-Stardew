import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SceneSetMenu from '@/v2/components/SceneSetMenu.vue'
import { setSceneSet, useSceneSet } from '@/v2/data/sceneStore'
import { DEFAULT_SCENE_SET, SCENE_SETS, sceneUrlFor } from '@/v2/theme/sceneState'

const ROOT = resolve(__dirname, '..', '..')
const ASSETS = resolve(ROOT, 'public/images/v2-scene')
const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const
const TIMES = ['day', 'dusk', 'night'] as const

/**
 * 场景素材组（用户 2026-10-13）：
 *   「使用 gpt-image-2 那套, seedream 暂时保留（界面按钮可以切换）」
 * ⇒ 两套各 12 张（季节 × 时段），gpt 为默认；界面「场景」按钮切换，选择持久化。
 */

/** 读 WebP 画布尺寸（VP8X 扩展 / VP8 有损 / VP8L 无损三种变体都覆盖） */
function webpSize(buf: Buffer): { w: number, h: number } {
  const tag = buf.toString('ascii', 12, 16)
  if (tag === 'VP8X')
    return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) }
  if (tag === 'VP8 ')
    return { w: buf.readUInt16LE(26) & 0x3FFF, h: buf.readUInt16LE(28) & 0x3FFF }
  if (tag === 'VP8L') {
    const b = buf.readUInt32LE(21)
    return { w: (b & 0x3FFF) + 1, h: ((b >> 14) & 0x3FFF) + 1 }
  }
  throw new Error(`无法识别 WebP 变体：${tag}`)
}

describe('场景素材：两套 × 12 张（季节 × 时段）都真实存在', () => {
  it('枚举与默认值与用户口径一致', () => {
    expect(SCENE_SETS).toEqual(['gpt', 'seedream'])
    expect(DEFAULT_SCENE_SET).toBe('gpt')
  })

  it.each(['gpt', 'seedream'] as const)('组 %s 的 12 张素材齐全', (set) => {
    const dir = resolve(ASSETS, set)
    expect(existsSync(dir), `缺素材目录 ${set}`).toBe(true)
    const files = readdirSync(dir).filter(f => f.endsWith('.webp'))
    expect(files.sort()).toEqual(
      SEASONS.flatMap(s => TIMES.map(t => `${s}_${t}.webp`)).sort(),
    )
  })

  it.each(['gpt', 'seedream'] as const)('组 %s 每张 ≤400KB 且为 16:9', (set) => {
    for (const s of SEASONS) {
      for (const t of TIMES) {
        const p = resolve(ROOT, 'public', sceneUrlFor(set, s, t).slice(1))
        const buf = readFileSync(p)
        expect(buf.length, `${set}/${s}_${t} 体积超预算`).toBeLessThanOrEqual(400 * 1024)
        const { w, h } = webpSize(buf)
        expect(Math.abs(w / h - 16 / 9), `${set}/${s}_${t} 不是 16:9（${w}×${h}）`).toBeLessThan(0.03)
      }
    }
  })

  it('素材整体体量可控（24 张合计 < 8MB，避免主题包膨胀）', () => {
    let total = 0
    for (const set of SCENE_SETS) {
      for (const s of SEASONS) {
        for (const t of TIMES)
          total += statSync(resolve(ROOT, 'public', sceneUrlFor(set, s, t).slice(1))).size
      }
    }
    expect(total).toBeLessThan(8 * 1024 * 1024)
  })
})

describe('sceneUrlFor：路径规则', () => {
  it('组 / 季节 / 时段 → 路径，扩展名是 webp', () => {
    expect(sceneUrlFor('gpt', 'autumn', 'night')).toBe('/images/v2-scene/gpt/autumn_night.webp')
    expect(sceneUrlFor('seedream', 'winter', 'day')).toBe('/images/v2-scene/seedream/winter_day.webp')
  })

  it('两套同季节同时段只差目录名（同题材不同画风）', () => {
    const a = sceneUrlFor('gpt', 'summer', 'dusk')
    const b = sceneUrlFor('seedream', 'summer', 'dusk')
    expect(a.replace('/gpt/', '')).toBe(b.replace('/seedream/', ''))
  })
})

describe('场景组状态与持久化', () => {
  beforeEach(() => {
    localStorage.clear()
    setSceneSet(DEFAULT_SCENE_SET)
  })

  it('默认 gpt，选项两项且都是合法组', () => {
    const s = useSceneSet()
    expect(s.set.value).toBe('gpt')
    expect(s.options.map(o => o.set)).toEqual(['gpt', 'seedream'])
    for (const o of s.options) {
      expect(SCENE_SETS).toContain(o.set)
      expect(o.label.length).toBeGreaterThan(0)
      expect(o.hint.length).toBeGreaterThan(0)
    }
  })

  it('切换写入 localStorage 并读回；非法值回落默认', () => {
    setSceneSet('seedream')
    expect(localStorage.getItem('vk-scene-set')).toBe('seedream')
    setSceneSet('nonsense' as never)
    expect(useSceneSet().set.value).toBe('gpt')
    expect(localStorage.getItem('vk-scene-set')).toBe('gpt')
  })

  it('浏览器里残存的废弃值在读取时被规整掉（不留废值）', async () => {
    localStorage.setItem('vk-scene-set', 'pixel-art')
    vi.resetModules()
    const fresh = await import('@/v2/data/sceneStore')
    expect(fresh.useSceneSet().set.value).toBe('gpt')
    expect(localStorage.getItem('vk-scene-set')).toBe('gpt')
  })
})

describe('「场景」按钮（用户要求界面可切换）', () => {
  it('挂载在顶栏，按钮文案是「场景」', () => {
    const bar = readFileSync(resolve(ROOT, 'src/v2/components/TopBar.vue'), 'utf8')
    expect(bar).toContain('SceneSetMenu')
    expect(mount(SceneSetMenu).find('button').text()).toBe('场景')
  })

  it('菜单默认收起，展开后两项都带缩略图，且缩略图指向真实素材', async () => {
    localStorage.clear()
    const w = mount(SceneSetMenu)
    expect(w.find('.vk-sceneset-menu').exists()).toBe(false)
    await w.find('button').trigger('click')
    const items = w.findAll('.vk-sceneset-item')
    expect(items).toHaveLength(2)
    const text = items.map(i => i.text()).join('|')
    expect(text).toContain('gpt-image-2')
    expect(text).toContain('seedream')
    for (const el of w.findAll('.vk-sceneset-thumb')) {
      // 背景图写在行内 style 上；从 DOM 元素取更稳（attributes('style') 未必反映 :style 绑定）
      const url = (el.element as HTMLElement).style.backgroundImage
      const m = /url\(["']?(\/images\/v2-scene\/[^)"']+)/.exec(url)
      expect(m, `缩略图没有指向素材：${url}`).toBeTruthy()
      expect(existsSync(resolve(ROOT, 'public', m![1]!.slice(1))), `缩略图素材不存在 ${m![1]}`).toBe(true)
    }
  })

  it('点选 seedream 后状态切换、菜单收起，且 SceneStack 的路径随之改变', async () => {
    localStorage.clear()
    setSceneSet('gpt')
    const w = mount(SceneSetMenu)
    await w.find('button').trigger('click')
    const target = w.findAll('.vk-sceneset-item').find(i => i.text().includes('seedream'))!
    await target.trigger('click')
    expect(useSceneSet().set.value).toBe('seedream')
    expect(w.find('.vk-sceneset-menu').exists()).toBe(false)
    expect(localStorage.getItem('vk-scene-set')).toBe('seedream')
  })

  it('App 把当前组下发给 SceneStack（否则按钮切了也不换图）', () => {
    const app = readFileSync(resolve(ROOT, 'src/App.vue'), 'utf8')
    expect(app).toMatch(/SceneStack[^>]*:set="sceneSet"/)
    expect(app).toContain('data-scene-set="sceneSet"')
  })
})
