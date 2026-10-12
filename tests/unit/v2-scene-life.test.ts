import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SceneStack from '@/v2/components/SceneStack.vue'
import {
  cropField,
  cropPlots,
  faunaPlan,
  FIELD_COLS,
  FIELD_ROWS,
  hashSeed,
  mulberry32,
  seasonHasFruit,
  seasonIsSnowy,
} from '@/v2/theme/life'
import type { CropStage } from '@/v2/theme/life'
import type { Season } from '@/v2/theme/sceneState'

const root = resolve(__dirname, '..', '..')
const lifeSrc = readFileSync(resolve(root, 'src/v2/components/SceneLife.vue'), 'utf8')

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']

/**
 * 新美术口径（用户明确要求）：场景装饰美术**一律使用 ListenHub 生成的透明 PNG 插画**，
 * 落在 `/images/v2-life/*.png`；**不得再用内联 SVG / CSS 手搓图形**。
 * 本表即「生长阶段 → 阶段插画」的唯一契约，UI 与单测共享。
 */
const STAGE_IMG: Record<CropStage, string> = {
  sprout: '/images/v2-life/crop-sprout.png',
  grow: '/images/v2-life/crop-grow.png',
  fruit: '/images/v2-life/crop-fruit.png',
  wither: '/images/v2-life/crop-wither.png',
}
const CROP_IMG_RE = /^\/images\/v2-life\/crop-(sprout|grow|fruit|wither)\.png$/

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

describe('SceneLife 美术口径：ListenHub PNG 插画 / 生长循环 / reduced-motion', () => {
  it('生长循环四阶段各引用一张 /images/v2-life/ 阶段插画，且素材文件真实存在', () => {
    for (const [stage, src] of Object.entries(STAGE_IMG)) {
      // 组件内 STAGE_IMG 映射必须逐条引用对应 PNG（春嫩芽 / 夏生长 / 秋结果 / 冬枯萎）
      expect(lifeSrc).toContain(`${stage}: '${src}',`)
      // 且不得残留旧的 @keyframes vk-st-* 手搓生长图元
      expect(lifeSrc).not.toContain(`@keyframes vk-st-${stage}`)
      // 引用的素材必须真的躺在 public/images/v2-life/ 下（部署后即 /images/v2-life/）
      expect(existsSync(resolve(root, `public${src}`))).toBe(true)
    }
  })

  it('四阶段贴图与季节挂钩（春萌发 / 夏生长 / 秋结果 / 冬枯萎）', () => {
    const primary: Array<[Season, CropStage]> = [
      ['spring', 'sprout'],
      ['summer', 'grow'],
      ['autumn', 'fruit'],
      ['winter', 'wither'],
    ]
    for (const [season, stage] of primary) {
      const stages = new Set(cropPlots(season).map(c => c.stage))
      expect(stages.has(stage)).toBe(true)
      // 该季主阶段必须能落到对应的 PNG 素材
      expect(lifeSrc).toContain(STAGE_IMG[stage])
    }
    // 两侧各一列 × 四排成畦 → 8 株
    expect(cropPlots('summer')).toHaveLength(FIELD_ROWS * FIELD_COLS * 2)
  })

  it('场景美术一律用 PNG 素材：含 /images/v2-life/ 且不含内联 <svg> 手搓图形', () => {
    // 必须通过 <img> 引用 ListenHub 生成的插画
    expect(lifeSrc).toContain('<img')
    expect(lifeSrc).toContain(':src="STAGE_IMG[')
    expect(lifeSrc).toMatch(/\/images\/v2-life\/[a-z-]+\.png/)
    // 不得再用内联 SVG 手搓装饰图形
    expect(lifeSrc).not.toContain('<svg')
    expect(lifeSrc).not.toContain('</svg>')
    expect(lifeSrc).not.toMatch(/<path\b|<circle\b|<polygon\b|<rect\b/)
  })

  it('渲染出的作物全部指向 /images/v2-life/ 阶段贴图（无内联 SVG 图元）', () => {
    for (const season of SEASONS) {
      const wrapper = mount(SceneStack, { props: { time: 'day', season } })
      const imgs = wrapper.findAll('.vk-crop-img')
      expect(imgs.length).toBeGreaterThan(0)
      const srcs = imgs.map(img => img.attributes('src') ?? '')
      for (const src of srcs) {
        expect(src).toMatch(CROP_IMG_RE)
      }
      // 渲染结果里不得出现任何 svg 装饰
      expect(wrapper.find('.vk-life svg').exists()).toBe(false)
      wrapper.unmount()
    }
  })

  it('尊重 prefers-reduced-motion（动画关闭 → 退化静态）', () => {
    expect(lifeSrc).toContain('prefers-reduced-motion: reduce')
    expect(lifeSrc).toContain('animation: none !important')
  })

  it('站立基线落在卡片网格上方的露台带（min(37vh,336px)）', () => {
    expect(lifeSrc).toContain('--vk-life-line: min(37vh, 336px)')
  })
})
