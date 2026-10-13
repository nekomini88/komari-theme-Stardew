/**
 * 场景世界（时间 / 季节 / 天气）的管理员配置解析
 *
 * 机制：Komari 不提供主题自定义后台页面，管理员通过 `komari-theme.json` 的
 * `configuration.data` 声明配置项，值经 `public:getPublicSettings` 的
 * `theme_settings` 下发到前端。本模块把那份不可信输入解析成强类型配置。
 *
 * 口径（用户要求，勿改）：
 *  - 时间基准是**我们的时间（UTC+8）**，不跟随访客本地时钟 → 见 `@/utils/serverClock`；
 *  - 不再提供 URL 覆盖口，一切手动覆盖只走这里声明的配置项。
 *
 * 防御式解析参照 `@/stores/app` 的既有模式：typeof 校验 + 合法值白名单 + 默认值。
 */
import type { Season, TimeOfDay, Weather } from '@/v2/theme/sceneState'
import { SEASONS, TIMES_OF_DAY, WEATHERS } from '@/v2/theme/sceneState'

/** 时间来源：auto = 跟随我们的时间（UTC+8）；fixed = 固定为指定时段 */
export type SceneTimeMode = 'auto' | 'fixed'
/** 季节来源：auto = 跟随我们的时间；fixed = 固定为指定季节 */
export type SceneSeasonMode = 'auto' | 'fixed'
/** 天气来源：off = 关闭；auto = 每日确定性随机；fixed = 固定为指定天气 */
export type WeatherMode = 'off' | 'auto' | 'fixed'

export interface SceneConfig {
  timeMode: SceneTimeMode
  fixedTime: TimeOfDay
  seasonMode: SceneSeasonMode
  fixedSeason: Season
  weatherMode: WeatherMode
  fixedWeather: Weather
}

export const SCENE_TIME_MODES: readonly SceneTimeMode[] = ['auto', 'fixed'] as const
export const SCENE_SEASON_MODES: readonly SceneSeasonMode[] = ['auto', 'fixed'] as const
export const WEATHER_MODES: readonly WeatherMode[] = ['off', 'auto', 'fixed'] as const

/** 默认值：全部跟随我们的时间，天气开启但为自动 */
export const SCENE_CONFIG_DEFAULTS: SceneConfig = {
  timeMode: 'auto',
  fixedTime: 'day',
  seasonMode: 'auto',
  fixedSeason: 'spring',
  weatherMode: 'auto',
  fixedWeather: 'clear',
}

function pickFrom<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof raw === 'string' && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback
}

/**
 * 把 `theme_settings`（不可信输入）解析成场景配置。
 *
 * 任何缺失、类型错误或非法值都退回 `SCENE_CONFIG_DEFAULTS` 的对应项，不抛错。
 */
export function resolveSceneConfig(themeSettings: unknown): SceneConfig {
  const s = (themeSettings && typeof themeSettings === 'object')
    ? themeSettings as Record<string, unknown>
    : {}

  return {
    timeMode: pickFrom(s.sceneTimeMode, SCENE_TIME_MODES, SCENE_CONFIG_DEFAULTS.timeMode),
    fixedTime: pickFrom(s.sceneFixedTime, TIMES_OF_DAY, SCENE_CONFIG_DEFAULTS.fixedTime),
    seasonMode: pickFrom(s.sceneSeasonMode, SCENE_SEASON_MODES, SCENE_CONFIG_DEFAULTS.seasonMode),
    fixedSeason: pickFrom(s.sceneFixedSeason, SEASONS, SCENE_CONFIG_DEFAULTS.fixedSeason),
    weatherMode: pickFrom(s.weatherMode, WEATHER_MODES, SCENE_CONFIG_DEFAULTS.weatherMode),
    fixedWeather: pickFrom(s.weatherFixed, WEATHERS, SCENE_CONFIG_DEFAULTS.fixedWeather),
  }
}
