import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import SceneStack from '@/v2/components/SceneStack.vue'
import {
  SCENE_DIR,
  sceneUrlFor,
  seasonFromMonth,
  timeOfDayFromHour,
  TRANSITION_MS,
  weatherFromDaySeed,
} from '@/v2/theme/sceneState'

const root = resolve(__dirname, '..', '..')

const stackSrc = readFileSync(resolve(root, 'src/v2/components/SceneStack.vue'), 'utf8')
const sceneCss = readFileSync(resolve(root, 'src/styles/v2/base/scene.css'), 'utf8')

describe('SceneStack 架构：整幅场景图（季节 × 时段，不做分层拼接）', () => {
  it('换图用 1.2s 交叉淡化，且 CSS 令牌与常量一致', () => {
    expect(TRANSITION_MS).toBe(1200)
    const tokens = readFileSync(resolve(root, 'src/styles/v2/tokens/tokens.css'), 'utf8')
    expect(tokens).toContain(`--vk-transition-ms: ${TRANSITION_MS}ms`)
    expect(sceneCss).toContain('animation: vk-scene-plate-in var(--vk-transition-ms')
    expect(sceneCss).toContain('@keyframes vk-scene-plate-in')
  })

  it('分层架构已退役：不再有 vk-layer / vk-tint / vk-sky 样式与图元', () => {
    for (const dead of ['.vk-layer', '.vk-tint', '.vk-sky', '.vk-decor-', 'vk-layer-base'])
      expect(sceneCss).not.toContain(dead)
    // 组件也不该再引用已删除的装饰/生态组件
    expect(stackSrc).not.toContain('SceneDecor')
    expect(stackSrc).not.toContain('SceneLife')
  })

  it('素材路径只由 sceneUrlFor 推导，组件里不写死任何图片路径/扩展名', () => {
    expect(stackSrc, '组件必须走 sceneUrlFor').toContain('sceneUrlFor')
    expect(stackSrc, '组件不该再自己拼目录').not.toContain("'/images/v2-scene")
    expect(stackSrc, '扩展名应由 sceneState 决定').not.toContain('.png')
    expect(stackSrc).not.toContain('<svg')
  })
})

describe('SceneStack 渲染行为', () => {
  it('按 props.set/season/time 选图，且始终只有「进入层」一张', () => {
    const wrapper = mount(SceneStack, { props: { set: 'gpt', season: 'autumn', time: 'dusk' } })
    expect(wrapper.attributes('data-time')).toBe('dusk')
    expect(wrapper.attributes('data-season')).toBe('autumn')
    expect(wrapper.attributes('data-set')).toBe('gpt')
    expect(wrapper.attributes('data-arch')).toBe('full-bleed')
    const plates = wrapper.findAll('.vk-scene-plate')
    expect(plates).toHaveLength(1)
    expect(plates[0]!.attributes('data-role')).toBe('enter')
    expect(plates[0]!.attributes('style')).toContain(sceneUrlFor('gpt', 'autumn', 'dusk'))
  })

  it('默认组 = gpt-image-2（用户指定），默认季节夏天', () => {
    const w = mount(SceneStack)
    expect(w.attributes('data-set')).toBe('gpt')
    expect(w.attributes('data-season')).toBe('summer')
    expect(w.get('.vk-scene-plate').attributes('style')).toContain('/images/v2-scene/gpt/summer_day.webp')
  })

  it('换素材组也走交叉淡化（两套之间切换不是硬切）', async () => {
    vi.useFakeTimers()
    const wrapper = mount(SceneStack, { props: { set: 'gpt', season: 'autumn', time: 'dusk' } })
    await wrapper.setProps({ set: 'seedream' })
    await nextTick()
    expect(wrapper.findAll('.vk-scene-plate')).toHaveLength(2)
    expect(wrapper.get('.vk-scene-plate[data-role="leave"]').attributes('style')).toContain('/v2-scene/gpt/autumn_dusk.webp')
    expect(wrapper.get('.vk-scene-plate[data-role="enter"]').attributes('style')).toContain('/v2-scene/seedream/autumn_dusk.webp')
    vi.advanceTimersByTime(TRANSITION_MS + 10)
    await nextTick()
    expect(wrapper.findAll('.vk-scene-plate')).toHaveLength(1)
    vi.useRealTimers()
  })

  it('切换时段时同时保留「退场层 + 进入层」→ 交叉淡化而非硬切', async () => {
    vi.useFakeTimers()
    const wrapper = mount(SceneStack, { props: { set: 'gpt', season: 'spring', time: 'day' } })
    await wrapper.setProps({ time: 'dusk' })
    await nextTick()

    const plates = wrapper.findAll('.vk-scene-plate')
    expect(plates).toHaveLength(2)
    const leave = wrapper.get('.vk-scene-plate[data-role="leave"]')
    expect(leave.attributes('style')).toContain(sceneUrlFor('gpt', 'spring', 'day'))
    expect(wrapper.get('.vk-scene-plate[data-role="enter"]').attributes('style')).toContain(sceneUrlFor('gpt', 'spring', 'dusk'))
    expect(wrapper.attributes('data-transitioning')).toBe('true')

    // 过渡结束后退场层被移除
    vi.advanceTimersByTime(TRANSITION_MS + 10)
    await nextTick()
    expect(wrapper.findAll('.vk-scene-plate')).toHaveLength(1)
    vi.useRealTimers()
  })

  it('场景层不被内容遮挡：z-index 0，内容层在其上', () => {
    expect(sceneCss).toMatch(/\.vk-scene\s*\{[^}]*z-index:\s*0/)
    const shell = readFileSync(resolve(root, 'src/styles/v2/base/shell.css'), 'utf8')
    expect(shell).toMatch(/\.vk-main\s*\{[^}]*z-index:\s*1/)
  })

  it('尊重「减少动态效果」偏好', () => {
    expect(sceneCss).toContain('prefers-reduced-motion')
  })
})

describe('素材路径规则 + 时间/季节/天气推导（纯函数）', () => {
  it('路径 = <根目录>/<组>/<季节>_<时段>.webp', () => {
    expect(SCENE_DIR).toBe('/images/v2-scene')
    expect(sceneUrlFor('gpt', 'winter', 'night')).toBe('/images/v2-scene/gpt/winter_night.webp')
    expect(sceneUrlFor('seedream', 'spring', 'day')).toBe('/images/v2-scene/seedream/spring_day.webp')
  })

  it('小时 → 时段', () => {
    expect(timeOfDayFromHour(0)).toBe('night')
    expect(timeOfDayFromHour(5)).toBe('night')
    expect(timeOfDayFromHour(6)).toBe('day')
    expect(timeOfDayFromHour(12)).toBe('day')
    expect(timeOfDayFromHour(16)).toBe('day')
    expect(timeOfDayFromHour(17)).toBe('dusk')
    expect(timeOfDayFromHour(18)).toBe('dusk')
    expect(timeOfDayFromHour(19)).toBe('night')
    expect(timeOfDayFromHour(23)).toBe('night')
  })

  it('月份 → 季节', () => {
    expect(seasonFromMonth(1)).toBe('winter')
    expect(seasonFromMonth(3)).toBe('spring')
    expect(seasonFromMonth(6)).toBe('summer')
    expect(seasonFromMonth(9)).toBe('autumn')
    expect(seasonFromMonth(12)).toBe('winter')
  })

  it('天气确定性：同一天两次调用结果一致（不随刷新乱跳）', () => {
    for (let d = 1; d <= 28; d += 7) {
      const a = weatherFromDaySeed(2026, 10, d, 'autumn')
      const b = weatherFromDaySeed(2026, 10, d, 'autumn')
      expect(a).toBe(b)
    }
  })

  it('天气季节自洽：冬天只可能下雪（不下雨），非冬天不下雪', () => {
    for (let d = 1; d <= 28; d++) {
      expect(weatherFromDaySeed(2026, 1, d, 'winter')).not.toBe('rain')
      expect(weatherFromDaySeed(2026, 7, d, 'summer')).not.toBe('snow')
    }
  })

  it('天气以晴朗为主（占比 > 40%）', () => {
    let clear = 0
    const n = 365
    for (let d = 0; d < n; d++) {
      const date = new Date(Date.UTC(2026, 0, 1 + d))
      if (weatherFromDaySeed(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), 'summer') === 'clear')
        clear++
    }
    expect(clear / n).toBeGreaterThan(0.4)
  })
})
