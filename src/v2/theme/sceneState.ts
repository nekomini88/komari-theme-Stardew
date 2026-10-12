/**
 * SceneStack 场景状态机（纯逻辑，无副作用 → 可单测）
 *
 * 对应 ART_SYSTEM.md 第 2 节「场景不割裂的工程做法」：
 *  - 场景 = 单一状态源（时间 × 季节）驱动的图层栈，而不是「背景图 + 角色贴图」。
 *  - 变化 = 整栈同步套一层 tint + 换天空色带；季节只改整栈 tint，绝不每层各换一套图。
 *  - 过渡 = 交叉淡化（crossfade），禁止硬切。
 *
 * 所有颜色均取自 src/assets/palette.json 的 41 色母板（见 palette.ts / 单测校验）。
 */

import { PALETTE_HEXES } from './palette'

/** 一天中的三个时段（黄昏是昼色的统一 tint，而非独立配色） */
export type TimeOfDay = 'day' | 'dusk' | 'night'
/** 季节 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

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
  /** 场景底图 URL（按时间切换、季节素材优先；见 sceneBackgroundUrl） */
  backgroundUrl: string
  /** 共享地面基线 */
  groundBaseline: typeof GROUND_BASELINE_LAYER
}

/** 各时段的天空 4 段色带（top → bottom），全部 ⊆ 母板。
 *  黄昏不再是昼色带：黄昏改用暖色带（蜜色高光 → 黄昏橙 → 蜜橘 → 土色），
 *  与昼的冷蓝天色真正不同，避免「昼/昏天空完全一致」。 */
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

/** 时间 tint：昼无叠加、黄昏统一 #e8a05c、夜只留极淡冷调（夜景亮化改由 scene.css 抬底图亮度承担，避免再压暗） */
const TIME_TINTS: Record<TimeOfDay, TintSpec> = {
  day: { color: '#7ec8f2', opacity: 0 },
  dusk: { color: '#e8a05c', opacity: 0.35 },
  night: { color: '#3a548c', opacity: 0.05 },
}

/** 季节 tint：只对整栈套一层，颜色取自母板的季节色 */
const SEASON_TINTS: Record<Season, TintSpec> = {
  spring: { color: '#8fc9a6', opacity: 0.10 },
  summer: { color: '#f4d9a0', opacity: 0.06 },
  autumn: { color: '#d9c27a', opacity: 0.14 },
  winter: { color: '#6b8fa8', opacity: 0.18 },
}

/**
 * 已接入的场景底图（整幅手绘田园插画，按访客本地时间切换）。
 * 素材缺失的时段不登记 → 由 sceneBackgroundUrl 回退，接口原地保留。
 */
const SCENE_BG: Record<TimeOfDay, string> = {
  day: '/images/v2-scene/ui-farm-bg.png',
  dusk: '/images/v2-scene/ui-farm-dusk.png',
  night: '/images/v2-scene/ui-farm-night.png',
}

/**
 * 季节底图（覆盖整幅插画，仅用于白天时段：日出/黄昏/夜晚仍按光影变体切换，
 * 让「时间光影」全年有效；季节则改变白天的田园面貌）。
 */
const SEASON_BG: Partial<Record<Season, string>> = {
  autumn: '/images/v2-scene/ui-farm-autumn.png',
  winter: '/images/v2-scene/ui-farm-winter.png',
}

/**
 * 解析场景底图：
 *  - 黄昏/夜晚 → 对应光影变体（季节不改变夜色）
 *  - 白天 → 有季节素材则用季节图（秋/冬），否则用白天图（春/夏）
 */
export function sceneBackgroundUrl(time: TimeOfDay, season: Season): string {
  if (time !== 'day')
    return SCENE_BG[time]
  return SEASON_BG[season] ?? SCENE_BG.day
}

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
    backgroundUrl: sceneBackgroundUrl(time, season),
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
