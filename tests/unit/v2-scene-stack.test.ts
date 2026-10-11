import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import SceneStack from '@/v2/components/SceneStack.vue'
import {
  GROUND_BASELINE_LAYER,
  layerOffset,
  resolveScene,
  sceneBackgroundUrl,
  seasonFromMonth,
  SCENE_LAYERS,
  timeOfDayFromHour,
  TRANSITION_MS,
  TRANSITION_MODE,
} from '@/v2/theme/sceneState'

const root = resolve(__dirname, '..', '..')

describe('SceneStack 状态机：时间 × 季节 → 层参数/tint（ART_SYSTEM §2）', () => {
  it('过渡为 1.2s 交叉淡化，禁止硬切', () => {
    expect(TRANSITION_MS).toBe(1200)
    expect(TRANSITION_MODE).toBe('crossfade')
    // CSS 令牌必须与状态机常量一致（否则动画时长会与状态机脱节）
    const tokens = readFileSync(resolve(root, 'src/styles/v2/tokens.css'), 'utf8')
    expect(tokens).toContain(`--vk-transition-ms: ${TRANSITION_MS}ms`)
  })

  it('五层视差与共享 ground 基线固定', () => {
    expect(SCENE_LAYERS.map(l => l.id)).toEqual(['sky', 'far', 'mid', 'near', 'ground'])
    expect(SCENE_LAYERS.map(l => l.parallax)).toEqual([0, 0.2, 0.5, 0.8, 1])
    expect(resolveScene('day', 'summer').groundBaseline).toBe(GROUND_BASELINE_LAYER)
  })

  it('黄昏 = 昼色带 + 统一 tint #e8a05c（不是各层各换一套图）', () => {
    const day = resolveScene('day', 'summer')
    const dusk = resolveScene('dusk', 'summer')
    expect(dusk.skyBands).toEqual(day.skyBands)
    expect(dusk.layerColors).toEqual(day.layerColors)
    expect(dusk.timeTint.color).toBe('#e8a05c')
    expect(dusk.timeTint.opacity).toBeGreaterThan(0)
    expect(day.timeTint.opacity).toBe(0)
  })

  it('夜晚换天空色带（top 段为夜天色）', () => {
    const night = resolveScene('night', 'winter')
    expect(night.skyBands[0]).toBe('#3a548c')
    expect(night.layerColors.ground).toBe('#5a4034')
  })

  it('季节只改整栈 tint，不动天空色带与层基色', () => {
    const base = resolveScene('day', 'spring')
    for (const season of ['summer', 'autumn', 'winter'] as const) {
      const s = resolveScene('day', season)
      expect(s.skyBands).toEqual(base.skyBands)
      expect(s.layerColors).toEqual(base.layerColors)
      expect(s.seasonTint.color).not.toBe(base.seasonTint.color)
      expect(s.seasonTint.opacity).toBeGreaterThan(0)
    }
  })

  it('时间驱动层位移：视差系数越大位移越大（负方向）', () => {
    expect(layerOffset(100, 0)).toBeCloseTo(0)
    expect(layerOffset(100, 1)).toBeCloseTo(-100)
    expect(layerOffset(100, 0.5)).toBeCloseTo(-50)
    // 单调：parallax 增大 → offset 更负
    expect(layerOffset(80, 0.2)).toBeGreaterThan(layerOffset(80, 0.8))
  })
})

describe('时间/季节映射', () => {
  it('小时 → 时段', () => {
    expect(timeOfDayFromHour(5)).toBe('night')
    expect(timeOfDayFromHour(6)).toBe('day')
    expect(timeOfDayFromHour(16)).toBe('day')
    expect(timeOfDayFromHour(17)).toBe('dusk')
    expect(timeOfDayFromHour(18)).toBe('dusk')
    expect(timeOfDayFromHour(19)).toBe('night')
    expect(timeOfDayFromHour(0)).toBe('night')
  })

  it('月份 → 季节', () => {
    expect(seasonFromMonth(3)).toBe('spring')
    expect(seasonFromMonth(5)).toBe('spring')
    expect(seasonFromMonth(6)).toBe('summer')
    expect(seasonFromMonth(8)).toBe('summer')
    expect(seasonFromMonth(9)).toBe('autumn')
    expect(seasonFromMonth(11)).toBe('autumn')
    expect(seasonFromMonth(12)).toBe('winter')
    expect(seasonFromMonth(1)).toBe('winter')
    expect(seasonFromMonth(2)).toBe('winter')
  })

  it('场景底图按时间切换（季节素材用于白天）', () => {
    expect(sceneBackgroundUrl('day', 'summer')).toBe('/images/v2-scene/ui-farm-bg.png')
    expect(sceneBackgroundUrl('day', 'spring')).toBe('/images/v2-scene/ui-farm-bg.png')
    expect(sceneBackgroundUrl('dusk', 'spring')).toBe('/images/v2-scene/ui-farm-dusk.png')
    expect(sceneBackgroundUrl('night', 'summer')).toBe('/images/v2-scene/ui-farm-night.png')
    // 季节素材接入白天的乡村面貌（秋/冬），夜晚仍用夜色变体
    expect(sceneBackgroundUrl('day', 'autumn')).toBe('/images/v2-scene/ui-farm-autumn.png')
    expect(sceneBackgroundUrl('day', 'winter')).toBe('/images/v2-scene/ui-farm-winter.png')
    expect(sceneBackgroundUrl('night', 'winter')).toBe('/images/v2-scene/ui-farm-night.png')
    // resolveScene 必须带上同一底图，组件才能据此交叉淡化
    expect(resolveScene('day', 'autumn').backgroundUrl).toBe(sceneBackgroundUrl('day', 'autumn'))
  })
})

describe('SceneStack 组件：图层结构与交叉淡化行为', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染 4 个内容层 + 4 段天空色带（sky 单独渲染）', () => {
    const wrapper = mount(SceneStack, { props: { time: 'day', season: 'summer' } })
    expect(wrapper.find('.vk-sky-band').exists()).toBe(true)
    expect(wrapper.findAll('.vk-sky-band')).toHaveLength(4)
    const layers = wrapper.findAll('.vk-layer').map(n => n.attributes('data-layer'))
    expect(layers).toEqual(['far', 'mid', 'near', 'ground'])
    expect(wrapper.find('[data-tint="time-enter"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('切换时段时进入/离开两层同时存在（交叉淡化），1.2s 后清理', async () => {
    const wrapper = mount(SceneStack, { props: { time: 'day', season: 'summer' } })
    expect(wrapper.vm.isTransitioning).toBe(false)

    await wrapper.setProps({ time: 'dusk' })
    await nextTick()

    // 语义：不是硬切 —— 旧值(离开层)与新值(进入层)在同一帧共存
    expect(wrapper.vm.isTransitioning).toBe(true)
    expect(wrapper.vm.leavingTint).not.toBeNull()
    expect(wrapper.vm.currentTint.color).toBe('#e8a05c')
    expect(wrapper.find('[data-tint="time-leave"]').exists()).toBe(true)
    expect(wrapper.find('[data-tint="time-enter"]').exists()).toBe(true)

    // 过渡时长到期后离开层被清理
    vi.advanceTimersByTime(TRANSITION_MS)
    await nextTick()
    expect(wrapper.vm.isTransitioning).toBe(false)
    expect(wrapper.vm.leavingTint).toBeNull()
    expect(wrapper.find('[data-tint="time-leave"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('切换时段时场景底图交叉淡化（旧图淡出、新图淡入）', async () => {
    const wrapper = mount(SceneStack, { props: { time: 'day', season: 'summer' } })
    expect(wrapper.find('[data-bg="enter"]').attributes('style')).toContain('ui-farm-bg.png')

    await wrapper.setProps({ time: 'night' })
    await nextTick()

    // 新图进入层 + 旧图离开层同帧共存 → 交叉淡化
    expect(wrapper.find('[data-bg="enter"]').attributes('style')).toContain('ui-farm-night.png')
    expect(wrapper.find('[data-bg="leave"]').exists()).toBe(true)
    expect(wrapper.find('[data-bg="leave"]').attributes('style')).toContain('ui-farm-bg.png')
    expect(wrapper.vm.leavingBgUrl).toContain('ui-farm-bg.png')

    vi.advanceTimersByTime(TRANSITION_MS)
    await nextTick()
    expect(wrapper.find('[data-bg="leave"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('离开层的动画时长 = 令牌 1.2s（view 侧同步）', () => {
    const sceneCss = readFileSync(resolve(root, 'src/styles/v2/scene.css'), 'utf8')
    expect(sceneCss).toContain('animation: vk-tint-in var(--vk-transition-ms)')
    expect(sceneCss).toContain('animation: vk-tint-out var(--vk-transition-ms)')
    expect(sceneCss).toContain('.vk-scene-bg')
  })
})
