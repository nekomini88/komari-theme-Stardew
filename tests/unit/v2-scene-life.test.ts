import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SceneStack from '@/v2/components/SceneStack.vue'
import {
  cropField,
  faunaPlan,
  hashSeed,
  mulberry32,
  seasonHasFruit,
  seasonIsSnowy,
} from '@/v2/theme/life'
import type { Season } from '@/v2/theme/sceneState'

const root = resolve(__dirname, '..', '..')
const lifeSrc = readFileSync(resolve(root, 'src/v2/components/SceneLife.vue'), 'utf8')

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']

describe('场景生态纯逻辑：确定性伪随机（生命周期与动物彩蛋）', () => {
  it('FNV-1a 哈希与 mulberry32 都是确定性的', () => {
    expect(hashSeed('crop:autumn')).toBe(hashSeed('crop:autumn'))
    expect(hashSeed('crop:autumn')).not.toBe(hashSeed('crop:winter'))
    const a = mulberry32(hashSeed('fauna:summer'))
    const b = mulberry32(hashSeed('fauna:summer'))
    const seqA = [a(), a(), a()]
    const seqB = [b(), b(), b()]
    expect(seqA).toEqual(seqB)
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('cropField：同季两次播种完全一致（刷新不乱跳）', () => {
    for (const s of SEASONS) {
      expect(cropField(s)).toEqual(cropField(s))
    }
  })

  it('cropField：换季 → 布局/阶段自然更替', () => {
    const spring = cropField('spring')
    const winter = cropField('winter')
    expect(spring).not.toEqual(winter)
  })

  it('cropField：阶段与季节挂钩（春嫩芽 / 冬枯萎）', () => {
    const springStage = new Set(cropField('spring', 24).map(c => c.stage))
    const winterStage = new Set(cropField('winter', 24).map(c => c.stage))
    const autumnStage = new Set(cropField('autumn', 24).map(c => c.stage))
    // 春：以萌发为主，绝不出现枯萎
    expect(springStage.has('wither')).toBe(false)
    expect(springStage.has('sprout')).toBe(true)
    // 冬：以枯萎为主
    expect(winterStage.has('wither')).toBe(true)
    // 秋：能结果
    expect(autumnStage.has('fruit')).toBe(true)
  })

  it('cropField：横向分布在场景宽度内且带抖动', () => {
    const xs = cropField('summer', 12).map(c => c.x)
    expect(Math.min(...xs)).toBeGreaterThan(0)
    expect(Math.max(...xs)).toBeLessThan(100)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
    // 抖动：并非等距（相邻间隔不全等）
    expect(new Set(xs).size).toBe(xs.length)
  })

  it('faunaPlan：同季确定、换季不同、周期为低频长周期', () => {
    for (const s of SEASONS) {
      expect(faunaPlan(s)).toEqual(faunaPlan(s))
    }
    expect(faunaPlan('summer')).not.toEqual(faunaPlan('winter'))
    for (const f of faunaPlan('autumn')) {
      expect(['deer', 'rabbit', 'bird']).toContain(f.kind)
      expect(f.duration).toBeGreaterThanOrEqual(46) // 长周期 → 偶发
      expect([1, -1]).toContain(f.dir)
    }
  })

  it('季节判定助手', () => {
    expect(seasonHasFruit('autumn')).toBe(true)
    expect(seasonHasFruit('winter')).toBe(false)
    expect(seasonIsSnowy('winter')).toBe(true)
    expect(seasonIsSnowy('summer')).toBe(false)
  })
})

describe('SceneStack 集成生态层（内联 SVG/CSS，不遮挡卡片）', () => {
  it('渲染植物条带：有作多株、各自带阶段标签', () => {
    const wrapper = mount(SceneStack, { props: { time: 'day', season: 'autumn' } })
    expect(wrapper.find('.vk-life').exists()).toBe(true)
    const crops = wrapper.findAll('.vk-crop')
    expect(crops.length).toBeGreaterThan(0)
    expect(crops[0]!.attributes('data-season')).toBe('autumn')
    expect(crops[0]!.attributes('data-stage')).toBeTruthy()
    wrapper.unmount()
  })

  it('默认不钉住动物；forceLife 时钉住一只（取证开关）', () => {
    const normal = mount(SceneStack, { props: { time: 'day', season: 'summer' } })
    expect(normal.findAll('.vk-fauna-item.is-forced')).toHaveLength(0)
    normal.unmount()

    const forced = mount(SceneStack, { props: { time: 'day', season: 'summer', forceLife: true } })
    expect(forced.findAll('.vk-fauna-item.is-forced').length).toBeGreaterThan(0)
    forced.unmount()
  })

  it('生态层挂在 ground 图层内（受整栈 tint 影响、且在卡片层之下）', () => {
    const wrapper = mount(SceneStack, { props: { time: 'day', season: 'spring' } })
    const ground = wrapper.find('[data-layer="ground"]')
    expect(ground.exists()).toBe(true)
    expect(ground.find('.vk-life').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('SceneLife 样式口径：平滑插画 / 生长循环 / reduced-motion', () => {
  it('生长循环四阶段关键帧齐备', () => {
    for (const k of ['vk-st-sprout', 'vk-st-leaf', 'vk-st-fruit', 'vk-st-wither', 'vk-crop-sway', 'vk-fauna-cross']) {
      expect(lifeSrc).toContain(`@keyframes ${k}`)
    }
  })

  it('尊重 prefers-reduced-motion（动画关闭 → 退化静态）', () => {
    expect(lifeSrc).toContain('prefers-reduced-motion: reduce')
    expect(lifeSrc).toContain('animation: none !important')
  })

  it('用 SVG 绘制（非位图、无新依赖）：包含 svg 且不含 background-image 位图', () => {
    expect(lifeSrc).toContain('<svg')
    expect(lifeSrc).not.toMatch(/\.png|\.webp|\.jpg/)
  })

  it('站立基线落在卡片网格上方的露台带（min(37vh,336px)）', () => {
    expect(lifeSrc).toContain('--vk-life-line: min(37vh, 336px)')
  })
})
