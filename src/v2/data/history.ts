/**
 * 历史/Ping 序列构建（纯函数 → 可单测）
 *
 * 处理真实接口（common:getRecords / common:getNodeRecentStatus）的三种形态：
 *  - 空数据：返回空序列，min/max 归零，供图表显示空态
 *  - 单点：单点序列（图表用点而非线）
 *  - 断点：时间间隔 > gapFactor × 中位间隔，或 value<0（丢包）→ v = null 缺口
 */

import type { Series, SeriesPoint } from './types'
import { toFiniteNumber } from './metrics'

/** 原始记录：至少含 time 与一个数值字段 */
export interface TimeValueRecord {
  time: string
  value?: number
}

/** ISO 时间 → 毫秒；非法返回 NaN */
export function timeToMs(time: unknown): number {
  if (typeof time !== 'string' || time === '')
    return Number.NaN
  const t = Date.parse(time)
  return Number.isFinite(t) ? t : Number.NaN
}

/** 空序列 */
export function emptySeries(): Series {
  return { points: [], min: 0, max: 0, count: 0 }
}

/**
 * 构建序列
 * @param records 原始记录（已按所需字段映射为 { time, value }），乱序会被排序
 * @param opts.negativeAsGap value<0 视为缺口（默认 true，Ping 丢包语义）
 * @param opts.gapFactor 相邻间隔超过 中位间隔×factor 时插入缺口（默认 3，<=1 关闭）
 */
export function buildSeries(
  records: readonly TimeValueRecord[] | null | undefined,
  opts: { negativeAsGap?: boolean, gapFactor?: number } = {},
): Series {
  const negativeAsGap = opts.negativeAsGap ?? true
  const gapFactor = opts.gapFactor ?? 3
  const list = Array.isArray(records) ? records : []

  const raw: SeriesPoint[] = []
  for (const r of list) {
    const t = timeToMs(r?.time)
    if (!Number.isFinite(t))
      continue
    const v = toFiniteNumber(r?.value, Number.NaN)
    const value = !Number.isFinite(v) || (negativeAsGap && v < 0) ? null : v
    raw.push({ t, v: value })
  }

  if (raw.length === 0)
    return emptySeries()

  raw.sort((a, b) => a.t - b.t)

  // 计算中位间隔，用于识别断点
  const gaps: number[] = []
  for (let i = 1; i < raw.length; i++)
    gaps.push(raw[i]!.t - raw[i - 1]!.t)
  gaps.sort((a, b) => a - b)
  const median = gaps.length ? gaps[Math.floor(gaps.length / 2)]! : 0

  const points: SeriesPoint[] = []
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i]!
    if (i > 0 && gapFactor > 1 && median > 0) {
      const dt = cur.t - raw[i - 1]!.t
      if (dt > median * gapFactor) {
        // 在缺口前后各压入一个 null 点，让折线断开
        points.push({ t: raw[i - 1]!.t, v: null })
        points.push({ t: cur.t, v: null })
      }
    }
    points.push(cur)
  }

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let count = 0
  for (const p of points) {
    if (p.v === null)
      continue
    count++
    if (p.v < min)
      min = p.v
    if (p.v > max)
      max = p.v
  }
  if (count === 0) {
    min = 0
    max = 0
  }

  return { points, min, max, count }
}

/** 从 load 记录提取某字段的序列（records 为 { client, time, ...字段 } 列表） */
export function buildLoadSeries(
  records: readonly Record<string, unknown>[] | null | undefined,
  field: string,
): Series {
  const list = Array.isArray(records) ? records : []
  return buildSeries(
    list.map(r => ({ time: String(r?.time ?? ''), value: toFiniteNumber(r?.[field], Number.NaN) })),
    { negativeAsGap: false, gapFactor: 3 },
  )
}

/** 从 ping 记录提取指定 task 的序列（value<0 即丢包 → 缺口） */
export function buildPingSeries(
  records: readonly Record<string, unknown>[] | null | undefined,
  taskId?: number,
): Series {
  const list = Array.isArray(records) ? records : []
  const filtered = taskId === undefined
    ? list
    : list.filter(r => toFiniteNumber(r?.task_id, Number.NaN) === taskId)
  return buildSeries(
    filtered.map(r => ({ time: String(r?.time ?? ''), value: toFiniteNumber(r?.value, Number.NaN) })),
    { negativeAsGap: true, gapFactor: 3 },
  )
}

/**
 * 把序列归一化到 [0,1] 画布高度（用于迷你曲线）
 *  - 空/单点/全等值：返回 0.5 中线，避免除零
 */
export function normalizeSeries(series: Series): { t: number, y: number | null }[] {
  const { points, min, max } = series
  if (points.length === 0)
    return []
  const span = max - min
  return points.map((p) => {
    if (p.v === null)
      return { t: p.t, y: null }
    const y = span <= 0 ? 0.5 : (p.v - min) / span
    return { t: p.t, y }
  })
}

/* ------------------------------------------------------------------ *
 * 图表几何（纯函数 → 可单测）
 *
 * 把 Series 变换成像素坐标点：全部计算在此完成，组件只负责画。
 * 覆盖边界：
 *  - 空数据：empty=true、无点、min/max 归零
 *  - 单点：single=true，落在画布水平居中、垂直中线
 *  - 断点：null 把曲线切成多段（segments），不连线
 *  - 数值全相等 / 极值：跨度 span<=0 → 走中线；跨度再大也线性映射，无除零
 *  - 画布宽/高为 0：仍返回有限坐标（不做 NaN/Infinity 输出）
 * ------------------------------------------------------------------ */

/** 像素坐标点（已含 t/v 原值，便于 tooltip/断言） */
export interface ChartPixelPoint {
  x: number
  y: number
  t: number
  v: number
}

/** 一条连续曲线（>=1 个点；单点段长度为 1） */
export interface ChartModel {
  width: number
  height: number
  /** 无有效点（v !== null）→ 图表应显示空态占位 */
  empty: boolean
  /** 恰有一个有效点 → 组件画点而非线 */
  single: boolean
  /** 全部有效点（像素坐标） */
  points: ChartPixelPoint[]
  /** 连续线段集合（断点/null 处断开） */
  segments: ChartPixelPoint[][]
  /** 有效点最小/最大值（与 series 一致；空时均为 0） */
  min: number
  max: number
  /** 有效点数量 */
  count: number
  /** 内边距 */
  padding: number
}

const safeNum = (n: unknown, fallback = 0): number => {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? v : fallback
}

/**
 * Series → 像素坐标模型
 * @param series 任意序列（null/undefined 安全）
 * @param opts width/height 画布逻辑尺寸，padding 内边距（默认 6）
 */
export function buildChartModel(
  series: Series | null | undefined,
  opts: { width: number, height: number, padding?: number },
): ChartModel {
  const width = Math.max(0, safeNum(opts?.width))
  const height = Math.max(0, safeNum(opts?.height))
  const padding = Math.max(0, safeNum(opts?.padding ?? 6))
  const innerW = Math.max(0, width - padding * 2)
  const innerH = Math.max(0, height - padding * 2)

  const all = Array.isArray(series?.points) ? series!.points : []
  const min = safeNum(series?.min)
  const max = safeNum(series?.max)

  const valid = all.filter(p => p && p.v !== null) as { t: number, v: number }[]
  if (valid.length === 0) {
    return {
      width,
      height,
      empty: true,
      single: false,
      points: [],
      segments: [],
      min: 0,
      max: 0,
      count: 0,
      padding,
    }
  }

  const span = max - min
  const tMax = valid[valid.length - 1]!.t
  const tMin = valid[0]!.t
  const tSpan = tMax - tMin

  const xFor = (t: number): number => {
    if (tSpan <= 0)
      return padding + innerW / 2 // 单点 / 同一时刻：水平居中，防除零
    return padding + ((t - tMin) / tSpan) * innerW
  }
  const yFor = (v: number): number => {
    const norm = span <= 0 ? 0.5 : (v - min) / span // 全等值走中线，防除零
    return padding + (1 - norm) * innerH
  }

  const points: ChartPixelPoint[] = []
  const segments: ChartPixelPoint[][] = []
  let current: ChartPixelPoint[] = []

  for (const p of all) {
    if (!p || p.v === null) {
      if (current.length)
        segments.push(current)
      current = []
      continue
    }
    const px: ChartPixelPoint = { x: xFor(p.t), y: yFor(p.v), t: p.t, v: p.v }
    points.push(px)
    current.push(px)
  }
  if (current.length)
    segments.push(current)

  return {
    width,
    height,
    empty: false,
    single: points.length === 1,
    points,
    segments,
    min,
    max,
    count: points.length,
    padding,
  }
}

/** 像素点数组 → SVG path 的 `d`；不足 2 点返回空串（点用其它图元画） */
export function toPathD(points: readonly ChartPixelPoint[]): string {
  if (!Array.isArray(points) || points.length < 2)
    return ''
  const [first, ...rest] = points
  return `M ${first!.x} ${first!.y} ${rest.map(p => `L ${p.x} ${p.y}`).join(' ')}`
}

/** 横向网格线的 y 坐标（等分 innerH，返回 count-1 条） */
export function gridLines(model: ChartModel, count = 3): number[] {
  const n = Math.max(2, Math.trunc(safeNum(count, 3)))
  const out: number[] = []
  for (let i = 1; i < n; i++)
    out.push(model.padding + (model.height - model.padding * 2) * (i / n))
  return out
}
