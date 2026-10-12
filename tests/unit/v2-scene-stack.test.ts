import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import SceneStack from '@/v2/components/SceneStack.vue'
import {
  GROUND_BASELINE_LAYER,
  layerOffset,
  resolveScene,
  SCENE_LAYER_IMAGES,
  SCENE_LAYERS,
  seasonFromMonth,
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

  it('黄昏 = 独立暖色带 + 统一 tint #e8a05c（不是各层各换一套图）', () => {
    const day = resolveScene('day', 'summer')
    const dusk = resolveScene('dusk', 'summer')
    // 黄昏天色带必须与昼不同（探针实测：昼/昏天空带亮度需严格递减）
    expect(dusk.skyBands).not.toEqual(day.skyBands)
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

  it('场景是「真分层贴图」：sky/far/mid/ground 各一张，且素材真实存在（不再有整幅烘焙底图）', () => {
    expect(existsSync(resolve(root, `public${SCENE_LAYER_IMAGES.sky}`))).toBe(true)
    expect(existsSync(resolve(root, `public${SCENE_LAYER_IMAGES.far}`))).toBe(true)
    expect(existsSync(resolve(root, `public${SCENE_LAYER_IMAGES.mid}`))).toBe(true)
    expect(existsSync(resolve(root, `public${SCENE_LAYER_IMAGES.ground}`))).toBe(true)

    const sceneCss2 = readFileSync(resolve(root, 'src/styles/v2/scene.css'), 'utf8')
    for (const url of Object.values(SCENE_LAYER_IMAGES)) {
      expect(sceneCss2).toContain(url)
    }
    // 旧的「整幅烘焙底图按时间切换」必须已彻底移除（否则分层形同虚设、且与装饰层重影）
    expect(sceneCss2).not.toContain('ui-farm-bg.png')
    expect(sceneCss2).not.toContain('.vk-scene-bg')
    // 旧函数随烘焙底图口径一并删除（注释里可提及历史，但代码里不应再有）
    const stateSrc = readFileSync(resolve(root, 'src/v2/theme/sceneState.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    expect(stateSrc).not.toContain('sceneBackgroundUrl')
    expect(stateSrc).not.toContain('ui-farm-')
  })

  it('resolveScene 不再携带整幅底图 URL（昼夜/季节一律由整栈 tint 驱动）', () => {
    expect('backgroundUrl' in resolveScene('day', 'autumn')).toBe(false)
  })

  it('夜间由整栈 tint 真正压暗（中性分层底不能靠预暗底图）', () => {
    expect(resolveScene('night', 'summer').timeTint.opacity).toBeGreaterThan(0.4)
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

  it('切换时段时「只有 tint 交叉淡化」，不再切整幅底图（分层贴图常驻）', async () => {
    const wrapper = mount(SceneStack, { props: { time: 'day', season: 'summer' } })
    // 分层贴图由 scene.css 常驻提供，组件内不再渲染任何底图元素
    expect(wrapper.find('.vk-scene-bg').exists()).toBe(false)

    await wrapper.setProps({ time: 'night' })
    await nextTick()
    // 夜色 tint 与黄昏 tint 在同一帧共存 → 交叉淡化而非硬切
    expect(wrapper.vm.isTransitioning).toBe(true)
    expect(wrapper.find('[data-tint="time-enter"]').exists()).toBe(true)
    expect(wrapper.find('[data-tint="time-leave"]').exists()).toBe(true)

    vi.advanceTimersByTime(TRANSITION_MS)
    await nextTick()
    expect(wrapper.vm.isTransitioning).toBe(false)
    // 分层贴图仍在（不受时间切换影响）
    expect(wrapper.findAll('.vk-layer').length).toBe(4)

    wrapper.unmount()
  })

  it('离开层的动画时长 = 令牌 1.2s（view 侧同步），且已无整幅底图', () => {
    const sceneCss = readFileSync(resolve(root, 'src/styles/v2/scene.css'), 'utf8')
    expect(sceneCss).toContain('animation: vk-tint-in var(--vk-transition-ms)')
    expect(sceneCss).toContain('animation: vk-tint-out var(--vk-transition-ms)')
    expect(sceneCss).not.toContain('.vk-scene-bg')
  })
})
