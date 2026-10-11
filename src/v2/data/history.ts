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
