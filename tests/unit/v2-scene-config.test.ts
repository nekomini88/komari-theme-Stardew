import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  resolveSceneConfig,
  SCENE_CONFIG_DEFAULTS,
  SCENE_SEASON_MODES,
  SCENE_TIME_MODES,
  WEATHER_MODES,
} from '@/v2/theme/sceneConfig'
import { SEASONS, TIMES_OF_DAY, WEATHERS } from '@/v2/theme/sceneState'

interface ManifestEntry { key?: string, options?: string, default?: unknown, type?: string }
const manifest = JSON.parse(readFileSync('komari-theme.json', 'utf8'))
const entries: ManifestEntry[] = manifest.configuration.data
const entry = (key: string) => entries.find(e => e.key === key)

describe('场景配置解析：不可信 theme_settings → 强类型', () => {
  it('缺失 / 非对象输入一律退回默认', () => {
    for (const bad of [undefined, null, 'x', 42, [], true]) {
      expect(resolveSceneConfig(bad)).toEqual(SCENE_CONFIG_DEFAULTS)
    }
  })

  it('默认口径：时间与季节跟随我们的时间，天气为 auto（三态里的中间档）', () => {
    expect(SCENE_CONFIG_DEFAULTS.timeMode).toBe('auto')
    expect(SCENE_CONFIG_DEFAULTS.seasonMode).toBe('auto')
    expect(SCENE_CONFIG_DEFAULTS.weatherMode).toBe('auto')
  })

  it('合法值原样透传', () => {
    const cfg = resolveSceneConfig({
      sceneTimeMode: 'fixed',
      sceneFixedTime: 'night',
      sceneSeasonMode: 'fixed',
      sceneFixedSeason: 'winter',
      weatherMode: 'fixed',
      weatherFixed: 'snow',
    })
    expect(cfg).toEqual({
      timeMode: 'fixed',
      fixedTime: 'night',
      seasonMode: 'fixed',
      fixedSeason: 'winter',
      weatherMode: 'fixed',
      fixedWeather: 'snow',
    })
  })

  it('非法值逐项退回默认，不污染其他项', () => {
    const cfg = resolveSceneConfig({
      sceneTimeMode: 'nope',
      sceneFixedTime: 'midnight',
      sceneSeasonMode: 123,
      sceneFixedSeason: 'monsoon',
      weatherMode: 'always',
      weatherFixed: 42,
      themeSelection: 'emerald', // 无关项应被忽略
    })
    expect(cfg).toEqual(SCENE_CONFIG_DEFAULTS)
  })

  it('天气可以关闭：off 是合法值而不是非法值', () => {
    expect(resolveSceneConfig({ weatherMode: 'off' }).weatherMode).toBe('off')
  })
})

describe('契约：komari-theme.json 的配置项必须与代码枚举一致', () => {
  it('6 个场景配置项都已声明', () => {
    for (const key of [
      'sceneTimeMode',
      'sceneFixedTime',
      'sceneSeasonMode',
      'sceneFixedSeason',
      'weatherMode',
      'weatherFixed',
    ]) {
      expect(entry(key), `缺少配置项 ${key}`).toBeTruthy()
      expect(entry(key)?.type).toBe('select')
    }
  })

  it('options 白名单与 sceneState / sceneConfig 的枚举逐项一致（防止配置项与代码脱钩）', () => {
    const opts = (key: string) => (entry(key)?.options ?? '').split(',')
    expect(opts('sceneTimeMode')).toEqual([...SCENE_TIME_MODES])
    expect(opts('sceneFixedTime')).toEqual([...TIMES_OF_DAY])
    expect(opts('sceneSeasonMode')).toEqual([...SCENE_SEASON_MODES])
    expect(opts('sceneFixedSeason')).toEqual([...SEASONS])
    expect(opts('weatherMode')).toEqual([...WEATHER_MODES])
    expect(opts('weatherFixed')).toEqual([...WEATHERS])
  })

  it('配置项声明的 default 必须是该键白名单里的合法值', () => {
    for (const [key, allowed] of [
      ['sceneTimeMode', SCENE_TIME_MODES],
      ['sceneFixedTime', TIMES_OF_DAY],
      ['sceneSeasonMode', SCENE_SEASON_MODES],
      ['sceneFixedSeason', SEASONS],
      ['weatherMode', WEATHER_MODES],
      ['weatherFixed', WEATHERS],
    ] as const) {
      expect(allowed as readonly string[]).toContain(entry(key)?.default as string)
    }
  })
})

describe('口径守卫：场景世界不再有 URL 覆盖口', () => {
  const appSrc = readFileSync('src/App.vue', 'utf8')

  it('应用壳不再解析 URL 查询参数', () => {
    expect(appSrc).not.toContain('URLSearchParams')
    expect(appSrc).not.toContain('searchParams')
    expect(appSrc).not.toContain('location.search')
  })

  it('场景状态一律取自世界时钟（serverClock）', () => {
    expect(appSrc).toContain('@/utils/serverClock')
    expect(appSrc).toContain('worldHour')
    expect(appSrc).toContain('worldMonth')
    expect(appSrc).toContain('weatherFromDaySeed')
  })

  it('不再用访客本地时钟的 getHours/getMonth 推导场景', () => {
    expect(appSrc).not.toContain('now.getHours()')
    expect(appSrc).not.toContain('now.getMonth()')
  })
})
