import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SceneStack from '@/v2/components/SceneStack.vue'
import {
  fetchVisitorWeather,
  mapWmoCode,
  parseWeatherParam,
  WEATHER_FALLBACK,
  WEATHER_TIMEOUT_MS,
  WEATHER_TYPES,
} from '@/v2/theme/weather'

const root = resolve(__dirname, '..', '..')

describe('天气状态机：WMO 代码 → 场景天气类型（优雅退化）', () => {
  it('枚举与兜底', () => {
    expect(WEATHER_TYPES).toEqual(['clear', 'cloudy', 'rain', 'snow', 'fog', 'thunder'])
    expect(WEATHER_FALLBACK).toBe('clear')
    expect(WEATHER_TIMEOUT_MS).toBeGreaterThan(0)
  })

  it('晴 / 多云 / 雾', () => {
    expect(mapWmoCode(0)).toBe('clear')
    expect(mapWmoCode(1)).toBe('cloudy')
    expect(mapWmoCode(2)).toBe('cloudy')
    expect(mapWmoCode(3)).toBe('cloudy')
    expect(mapWmoCode(45)).toBe('fog')
    expect(mapWmoCode(48)).toBe('fog')
  })

  it('雨（毛毛雨/雨/阵雨）与雪（雪/阵雪）', () => {
    for (const c of [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82])
      expect(mapWmoCode(c)).toBe('rain')
    for (const c of [71, 73, 75, 77, 85, 86])
      expect(mapWmoCode(c)).toBe('snow')
  })

  it('雷暴', () => {
    for (const c of [95, 96, 99])
      expect(mapWmoCode(c)).toBe('thunder')
  })

  it('未知/非法代码一律退化为 clear（不抛错）', () => {
    expect(mapWmoCode(1234)).toBe('clear')
    expect(mapWmoCode(4 as number)).toBe('clear')
    expect(mapWmoCode(null)).toBe('clear')
    expect(mapWmoCode(undefined)).toBe('clear')
    expect(mapWmoCode(Number.NaN)).toBe('clear')
  })
})

describe('URL 参数覆盖（仅预览/截图用）', () => {
  it('合法值解析，非法/空返回 null', () => {
    expect(parseWeatherParam('rain')).toBe('rain')
    expect(parseWeatherParam('SNOW')).toBe('snow')
    expect(parseWeatherParam('thunder')).toBe('thunder')
    expect(parseWeatherParam('sunny')).toBeNull()
    expect(parseWeatherParam('')).toBeNull()
    expect(parseWeatherParam(null)).toBeNull()
    expect(parseWeatherParam(undefined)).toBeNull()
  })
})

describe('按访客 IP 取天气：任何失败都优雅退化', () => {
  const okGeo = { success: true, latitude: 31.2, longitude: 121.4 }

  it('定位 + 天气都成功 → 映射天气码', async () => {
    const calls: string[] = []
    const impl = async (url: string) => {
      calls.push(url)
      if (url.includes('ipwho.is'))
        return okGeo
      if (url.includes('open-meteo'))
        return { current: { weather_code: 61 } }
      return null
    }
    await expect(fetchVisitorWeather({ fetchJsonImpl: impl })).resolves.toBe('rain')
    expect(calls.some(u => u.includes('open-meteo'))).toBe(true)
    // 必须带上定位到的经纬度
    expect(calls.find(u => u.includes('open-meteo'))).toContain('latitude=31.2')
  })

  it('定位失败（success=false）→ clear，且不再请求天气', async () => {
    let weatherRequested = false
    const impl = async (url: string) => {
      if (url.includes('ipwho.is'))
        return { success: false }
      weatherRequested = true
      return { current: { weather_code: 95 } }
    }
    await expect(fetchVisitorWeather({ fetchJsonImpl: impl })).resolves.toBe('clear')
    expect(weatherRequested).toBe(false)
  })

  it('网络异常 / 抛错 / 无网络 → clear（绝不抛出）', async () => {
    const impl = async () => { throw new Error('offline') }
    await expect(fetchVisitorWeather({ fetchJsonImpl: impl })).resolves.toBe('clear')
  })

  it('返回体缺经纬度 → clear', async () => {
    const impl = async () => ({ success: true })
    await expect(fetchVisitorWeather({ fetchJsonImpl: impl })).resolves.toBe('clear')
  })

  it('天气返回体异常（无 current）→ clear', async () => {
    const impl = async (url: string) => (url.includes('ipwho.is') ? okGeo : {})
    await expect(fetchVisitorWeather({ fetchJsonImpl: impl })).resolves.toBe('clear')
  })
})

describe('SceneStack 天气层：只作用于场景，不覆盖卡片', () => {
  it('data-weather 反映 prop；默认 clear', () => {
    const wrapper = mount(SceneStack, { props: { time: 'night', season: 'summer' } })
    expect(wrapper.find('.vk-scene').attributes('data-weather')).toBe('clear')
    wrapper.unmount()
  })

  it('传入天气时渲染天气层（含雨/雪/雾/云影/闪 子层）', () => {
    const wrapper = mount(SceneStack, { props: { time: 'night', season: 'summer', weather: 'rain' } })
    expect(wrapper.find('.vk-scene').attributes('data-weather')).toBe('rain')
    const w = wrapper.find('.vk-weather')
    expect(w.exists()).toBe(true)
    expect(w.attributes('aria-hidden')).toBe('true')
    for (const c of ['vk-weather-rain', 'vk-weather-snow', 'vk-weather-fog', 'vk-weather-shadow', 'vk-weather-flash'])
      expect(w.find(`.${c}`).exists()).toBe(true)
    wrapper.unmount()
  })

  it('天气层位于场景内部（在卡片内容之下），不遮挡文字', () => {
    const wrapper = mount(SceneStack, { props: { time: 'day', season: 'summer', weather: 'snow' } })
    // .vk-weather 必须是 .vk-scene 的后代（场景在内容层之下）
    expect(wrapper.find('.vk-scene .vk-weather').exists()).toBe(true)
    wrapper.unmount()
  })

  it('CSS 约定：按 data-weather 打开子层 + reduced-motion 退化为静态', () => {
    const css = readFileSync(resolve(root, 'src/styles/v2/scene.css'), 'utf8')
    expect(css).toContain(".vk-scene[data-weather='rain'] .vk-weather-rain")
    expect(css).toContain(".vk-scene[data-weather='snow'] .vk-weather-snow")
    expect(css).toContain(".vk-scene[data-weather='fog'] .vk-weather-fog")
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('animation: none !important')
  })
})

describe('夜景亮化：看得见的夜空田园', () => {
  it('夜色底图有亮度抬升、天空色带退为透明、CSS 太阳收回', () => {
    const css = readFileSync(resolve(root, 'src/styles/v2/scene.css'), 'utf8')
    // 夜间底图亮度抬升
    expect(css).toMatch(/data-time='night'[^}]*\.vk-scene-bg[^}]*brightness\(1\.\d+\)/s)
    // 夜空色带不再盖住插画自带星空/月亮
    expect(css).toMatch(/data-time='night'[^}]*\.vk-sky-band\s*\{[^}]*opacity:\s*0/s)
    // 收回与插画月亮重影的 CSS 太阳
    expect(css).toMatch(/data-time='night'[^}]*\.vk-sun\s*\{[^}]*display:\s*none/s)
  })

  it('夜间时间 tint 不再压暗（低不透明度）', async () => {
    const { resolveScene } = await import('@/v2/theme/sceneState')
    const night = resolveScene('night', 'summer')
    expect(night.timeTint.opacity).toBeLessThanOrEqual(0.06)
    // 仍保留时间态（不会退化成无 tint 的硬切）
    expect(night.timeTint.color).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
