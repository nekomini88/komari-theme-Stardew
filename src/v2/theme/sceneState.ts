/**
 * 场景世界的**纯逻辑**：时段 / 季节 / 天气 / 素材组的枚举与推导（无副作用 → 可单测）
 *
 * 【口径变更 2026-10-13】场景从「白天/黄昏/夜晚 三张」升级为
 * **「季节 × 时段」12 张 × 两套素材**（用户：12 张农场场景 + 界面按钮切换两套）。
 * 光照仍烘在图里，不分层、不做整栈 tint。
 *
 * 素材：public/images/v2-scene/<组>/<季节>_<时段>.webp
 *   组 gpt      —— gpt-image-2 那套（细节写实、层次多）＝ 默认
 *   组 seedream —— seedream 5.0 pro 那套（柔和绘本感、留白多）
 * 编码口径见 /root/v2_art/farm12/install_farm_scene_assets.py（WebP q=88，实测优于 PNG 索引色）。
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

/**
 * 场景素材组（两套同题材、不同画风的 12 张，界面按钮可切换）。
 * 用户 2026-10-13：「使用 gpt-image-2 那套, seedream 暂时保留（界面按钮可以切换）」。
 */
export type SceneSet = 'gpt' | 'seedream'

/** 素材组枚举（控件与测试共用同一份，避免多处手抄） */
export const SCENE_SETS: readonly SceneSet[] = ['gpt', 'seedream'] as const

/** 默认素材组 = gpt-image-2 那套（用户指定） */
export const DEFAULT_SCENE_SET: SceneSet = 'gpt'

/** 场景素材根目录（`/images/v2-scene/<组>/<季节>_<时段>.webp`） */
export const SCENE_DIR = '/images/v2-scene'

/** 季节 × 时段 × 素材组 → 素材 URL（纯函数，可单测；素材是否存在由单测守） */
export function sceneUrlFor(set: SceneSet, season: Season, time: TimeOfDay): string {
  return `${SCENE_DIR}/${set}/${season}_${time}.webp`
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
