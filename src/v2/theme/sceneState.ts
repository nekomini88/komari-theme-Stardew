/**
 * SceneStack 场景状态机（纯逻辑，无副作用 → 可单测）
 *
 * 对应 ART_SYSTEM.md 第 2 节「场景不割裂的工程做法」：
 *  - 场景 = 单一状态源（时间 × 季节）驱动的图层栈，而不是「背景图 + 角色贴图」。
 *  - 变化 = 整栈同步套一层 tint + 换天空色带；季节只改整栈 tint，绝不每层各换一套图。
 *  - 过渡 = 交叉淡化（crossfade），禁止硬切。
 *
 * 所有颜色均取自 src/assets/palette.json 的 42 色母板（见 palette.ts / 单测校验）。
 */

import { PALETTE_HEXES } from './palette'

/** 一天中的三个时段（黄昏是昼色的统一 tint，而非独立配色） */
export type TimeOfDay = 'day' | 'dusk' | 'night'
/** 季节 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

/** 时段枚举（配置项白名单共用同一份，避免多处手抄） */
export const TIMES_OF_DAY: readonly TimeOfDay[] = ['day', 'dusk', 'night'] as const
/** 季节枚举（配置项白名单共用同一份） */
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'] as const

/** 图层定义：id + 视差系数（ART_SYSTEM §2） */
export interface SceneLayerSpec {
  id: 'sky' | 'far' | 'mid' | 'near' | 'ground'
  /** 视差系数：sky 固定、ground 随内容 1:1 滚动 */
  parallax: number
  /** 叠放次序，越大越靠近观察者 */
  z: number
}

/** 五层图层栈，视差系数是 ART_SYSTEM 规定的硬约束 */
export const SCENE_LAYERS: readonly SceneLayerSpec[] = [
  { id: 'sky', parallax: 0.0, z: 0 },
  { id: 'far', parallax: 0.2, z: 1 },
  { id: 'mid', parallax: 0.5, z: 2 },
  { id: 'near', parallax: 0.8, z: 3 },
  { id: 'ground', parallax: 1.0, z: 4 },
] as const

/** 所有站立元素共享的地面基线层 id（底部对齐到 ground 顶边） */
export const GROUND_BASELINE_LAYER = 'ground' as const

/** 状态切换的交叉淡化时长（ms），ART_SYSTEM：1.2s */
export const TRANSITION_MS = 1200

/** 过渡模式：交叉淡化（禁止硬切） */
export const TRANSITION_MODE = 'crossfade' as const

export interface TintSpec {
  color: string
  /** 0..1 */
  opacity: number
}

export interface ScenePreset {
  time: TimeOfDay
  season: Season
  transitionMs: number
  mode: typeof TRANSITION_MODE
  layers: readonly SceneLayerSpec[]
  /** 4 段天空色带，自上而下（非 CSS 渐变，用色块平移构成） */
  skyBands: string[]
  /** 每层的基色（随时间切换，黄昏沿用昼色 + tint） */
  layerColors: Record<'far' | 'mid' | 'near' | 'ground', string>
  /** 时间 tint（整栈统一叠加，黄昏=#e8a05c） */
  timeTint: TintSpec
  /** 季节 tint（只改整栈 tint，不动其它层参数） */
  seasonTint: TintSpec
  /** 共享地面基线 */
  groundBaseline: typeof GROUND_BASELINE_LAYER
}

/**
 * 各时段的天空 4 段色带（top → bottom），全部 ⊆ 母板。
 *  黄昏不再是昼色带：黄昏改用暖色带（蜜色高光 → 黄昏橙 → 蜜橘 → 土色），
 *  与昼的冷蓝天色真正不同，避免「昼/昏天空完全一致」。
 */
const SKY_BANDS: Record<TimeOfDay, string[]> = {
  day: ['#a6dcf7', '#7ec8f2', '#7ec8f2', '#4f9fd0'],
  dusk: ['#f2c574', '#e8a05c', '#d99a4e', '#a9764b'],
  night: ['#3a548c', '#2b3f6b', '#2b3f6b', '#1e2c4c'],
}

/** 各时段的层基色 */
const LAYER_COLORS: Record<TimeOfDay, Record<'far' | 'mid' | 'near' | 'ground', string>> = {
  day: { far: '#6fae8c', mid: '#a9764b', near: '#7fc45a', ground: '#a9764b' },
  dusk: { far: '#6fae8c', mid: '#a9764b', near: '#7fc45a', ground: '#a9764b' },
  night: { far: '#2f4a56', mid: '#5a4034', near: '#3f6b4c', ground: '#5a4034' },
}

/**
 * 时间 tint：昼无叠加、黄昏统一 #e8a05c、夜压暗成夜色。
 *  【口径变更 2026-10-12】中性分层底之后，夜不能再靠「预暗好的夜景底图」，
 *  必须由整栈 tint 真正压暗（原 0.05 是给烘焙夜景底图让路的，现在会白得像白天）。
 */
const TIME_TINTS: Record<TimeOfDay, TintSpec> = {
  day: { color: '#7ec8f2', opacity: 0 },
  dusk: { color: '#e8a05c', opacity: 0.4 },
  night: { color: '#1e2c4c', opacity: 0.7 },
}

/**
 * 季节 tint：只对整栈套一层，颜色取自母板的季节色。
 *  【口径修正 2026-10-12】原先各季 opacity 只有 0.06–0.18，配合「烘焙好的季节底图」够用；
 *  但改成中性分层底之后，这类强度根本压不住底色 —— 冬天依旧是绿草如茵。
 *  现在把季节色强度提到"真的能改变观感"的量级（冬季同时另加各层的去饱和/提亮，见 scene.css）。
 */
const SEASON_TINTS: Record<Season, TintSpec> = {
  spring: { color: '#8fc9a6', opacity: 0.12 },
  summer: { color: '#f4d9a0', opacity: 0.06 },
  autumn: { color: '#d9c27a', opacity: 0.26 },
  winter: { color: '#e6eef6', opacity: 0.42 },
}

/**
 * 已接入的场景分层素材（见 scene.css 的 `.vk-layer[data-layer=...]`）。
 *
 * 【口径变更 2026-10-12】原先这里是「整幅烘焙底图按时间/季节切换」（ui-farm-*.png）——
 * 那是**死光照**：太阳/云/远山/栅栏都烘进一张图里，昼夜只能整体加滤镜，且与装饰层重影。
 * 现改为 **真分层 + 中性光照**（DESIGN_REFERENCE §9）：
 *   sky  = sky-neutral.png（中性天空，不烘太阳/云）
 *   far  = far-hills.png     （远山横带）
 *   mid  = mid-ground.png    （栅栏 + 树丛）
 *   near = CSS 草沿
 *   ground = ground-neutral.png（中性草地）
 * 昼夜/季节一律由**整栈 tint** 驱动 → 任何时间 × 季节组合都连续可过渡。
 */
export const SCENE_LAYER_IMAGES = {
  sky: '/images/v2-scene/sky-neutral.png',
  far: '/images/v2-scene/far-hills.png',
  mid: '/images/v2-scene/mid-ground.png',
  ground: '/images/v2-scene/ground-neutral.png',
} as const

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

/** 天气（参考稿 §2.3：晴 / 雨 / 雪 / 风 / 雾 的随机氛围） */
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
 * 世界时钟下应走本函数，`weatherFromDate` 仅为兼容旧调用保留。
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

export function weatherFromDate(date: Date, season: Season): Weather {
  return weatherFromDaySeed(date.getFullYear(), date.getMonth() + 1, date.getDate(), season)
}

/** 解析时间 × 季节 → 整栈场景参数 */
export function resolveScene(time: TimeOfDay, season: Season): ScenePreset {
  return {
    time,
    season,
    transitionMs: TRANSITION_MS,
    mode: TRANSITION_MODE,
    layers: SCENE_LAYERS,
    skyBands: [...SKY_BANDS[time]],
    layerColors: { ...LAYER_COLORS[time] },
    timeTint: { ...TIME_TINTS[time] },
    seasonTint: { ...SEASON_TINTS[season] },
    groundBaseline: GROUND_BASELINE_LAYER,
  }
}

/** 某层在给定滚动量下的纵向位移（px），视差系数越大跟得越紧 */
export function layerOffset(scrollY: number, parallax: number): number {
  return -scrollY * parallax
}

/** 自检：状态机返回的每种颜色都必须落在母板内 */
export function sceneColorsAreInPalette(preset: ScenePreset): boolean {
  const used = [
    ...preset.skyBands,
    ...Object.values(preset.layerColors),
    preset.timeTint.color,
    preset.seasonTint.color,
  ]
  return used.every(c => PALETTE_HEXES.includes(c.toLowerCase()))
}
