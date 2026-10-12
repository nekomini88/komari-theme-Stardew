/**
 * 场景世界的**纯逻辑**：时段 / 季节 / 天气的枚举与推导（无副作用 → 可单测）
 *
 * 【口径变更 2026-10-12】场景改为「**整幅像素风插画 + 按时间换图**」（复刻《星露谷物语主题.pdf》，
 * 用户明确「不用切画面」），因此原先的分层状态机已退役：
 * 不再有 SCENE_LAYERS / resolveScene / skyBands / 整栈 tint / layerOffset —— 光照直接烘在图里。
 * 本模块只保留「时间/季节/天气怎么算出来」，渲染归 SceneStack.vue。
 *
 * 时间基准：我们的时间（UTC+8），见 @/utils/serverClock；不跟随访客本地时钟。
 */

/** 一天中的三个时段 = 三张场景图（day / dusk / night） */
export type TimeOfDay = 'day' | 'dusk' | 'night'
/** 季节（本期「先不做」，仅保留类型供配置项与上层调用点使用） */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

/** 时段枚举（配置项白名单共用同一份，避免多处手抄） */
export const TIMES_OF_DAY: readonly TimeOfDay[] = ['day', 'dusk', 'night'] as const
/** 季节枚举（配置项白名单共用同一份） */
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'] as const

/** 时段切换的交叉淡化时长（ms） */
export const TRANSITION_MS = 1200

/** 小时 → 时段（昼夜由真实时间驱动，保证场景自然切换） */
export function timeOfDayFromHour(hour: number): TimeOfDay {
  if (hour >= 6 && hour < 17)
    return 'day'
  if (hour >= 17 && hour < 19)
    return 'dusk'
  return 'night'
}

/** 月份(1..12) → 季节 */
export function seasonFromMonth(month: number): Season {
  if (month >= 3 && month <= 5)
    return 'spring'
  if (month >= 6 && month <= 8)
    return 'summer'
  if (month >= 9 && month <= 11)
    return 'autumn'
  return 'winter'
}

/** 天气（本期只支持 clear；保留枚举供配置项白名单使用） */
export type Weather = 'clear' | 'rain' | 'snow' | 'wind' | 'fog'

export const WEATHERS: readonly Weather[] = ['clear', 'rain', 'snow', 'wind', 'fog'] as const

/**
 * 年月日 × 季节 → 当天天气。
 *
 * 口径：
 *  - **确定性**（同一天同一结果，可测、不会每次刷新乱跳）——用日序做哈希，不用 Math.random。
 *  - **多为晴朗**（0.55）：天气是点缀，不该天天糊住场景。
 *  - **季节自洽**：冬天不下雨（改下雪），非冬天不下雪。
 *
 * 取种用显式年月日而非 `Date`，因为本地 getter 会按访客时区取值；
 * 世界时钟下应走本函数。
 */
export function weatherFromDaySeed(year: number, month: number, day: number, season: Season): Weather {
  const seed = year * 10000 + month * 100 + day
  let h = Math.imul(seed, 2654435761) >>> 0
  h = (h ^ (h >>> 13)) >>> 0
  const r = h / 4294967296
  if (r < 0.55)
    return 'clear'
  if (r < 0.72)
    return season === 'winter' ? 'snow' : 'rain'
  if (r < 0.85)
    return 'wind'
  return 'fog'
}
