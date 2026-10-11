/**
 * v2 指标格式化（纯函数，无副作用 → 可单测）
 *
 * 覆盖边界：0 / null / undefined / NaN / Infinity / 负数 / 超大值 / 单位切换 / 保留位数。
 * 所有输出均为无 DOM 依赖的字符串或数值，供卡片与图表复用。
 */

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'] as const
const LAST_UNIT = BYTE_UNITS[BYTE_UNITS.length - 1]!
const K = 1024

/** 归一化任意输入为有限数字；null/undefined/NaN/±Infinity → fallback(默认 0) */
export function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

/** 数值 → 0..100 百分比（钳制）；total<=0 时返回 0 */
export function toPercent(used: unknown, total: unknown): number {
  const u = toFiniteNumber(used)
  const t = toFiniteNumber(total)
  if (t <= 0)
    return 0
  return clamp(toPercentRaw(u, t), 0, 100)
}

/** 原始百分比（未钳制），供内部/图表使用 */
export function toPercentRaw(used: unknown, total: unknown): number {
  const u = toFiniteNumber(used)
  const t = toFiniteNumber(total)
  if (t <= 0)
    return 0
  return (u / t) * 100
}

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n))
    return min
  return Math.min(max, Math.max(min, n))
}

/** 保留位数的四舍五入（避免浮点尾巴）；decimals 会被钳到 0..6 */
export function roundTo(n: number, decimals = 0): number {
  const d = clamp(Math.trunc(toFiniteNumber(decimals)), 0, 6)
  const f = 10 ** d
  return Math.round((toFiniteNumber(n) + Number.EPSILON) * f) / f
}

/** 百分比字符串，如 42.5%（默认 1 位）；输入非法 → '0%' */
export function formatPercent(used: unknown, total: unknown, decimals = 1): string {
  return `${roundTo(toPercent(used, total), decimals)}%`
}

/** 百分比数值（已钳制 0..100），供进度条宽度使用 */
export function percentValue(used: unknown, total: unknown, decimals = 1): number {
  return roundTo(toPercent(used, total), decimals)
}

/**
 * 字节数 → 分离的数值/单位，如 { value: '1.5', unit: 'GB' }
 * 边界：0/负数/null → { value: '0', unit: 'B' }（decimals 默认 1）
 */
export function formatBytesSplit(bytes: unknown, decimals = 1): { value: string, unit: string } {
  const b = toFiniteNumber(bytes)
  if (b <= 0)
    return { value: '0', unit: 'B' }
  let i = Math.floor(Math.log(b) / Math.log(K))
  i = clamp(i, 0, BYTE_UNITS.length - 1)
  const unit = BYTE_UNITS[i] ?? LAST_UNIT
  return { value: roundTo(b / K ** i, decimals).toFixed(decimals), unit }
}

/** 字节数 → '1.5 GB' 字符串 */
export function formatBytes(bytes: unknown, decimals = 1): string {
  const { value, unit } = formatBytesSplit(bytes, decimals)
  return `${value} ${unit}`
}

/** 字节速率 → 分离数值/单位，单位带 /s */
export function formatBytesPerSecondSplit(bytes: unknown, decimals = 1): { value: string, unit: string } {
  const r = formatBytesSplit(bytes, decimals)
  return { value: r.value, unit: `${r.unit}/s` }
}

/** 字节速率 → '1.5 GB/s' 字符串 */
export function formatBytesPerSecond(bytes: unknown, decimals = 1): string {
  const { value, unit } = formatBytesPerSecondSplit(bytes, decimals)
  return `${value} ${unit}`
}

/** 秒 → 紧凑在线时长，如 '12d 3h' / '3h 20m' / '45s'；非法/负数 → '—' */
export function formatUptime(seconds: unknown): string {
  const s = Math.floor(toFiniteNumber(seconds))
  if (s <= 0)
    return '—'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0)
    return `${d}d ${h}h`
  if (h > 0)
    return `${h}h ${m}m`
  if (m > 0)
    return `${m}m`
  return `${s % 60}s`
}

/** 负载 → 相对核数的百分比字符串（如 '35%'）；cores<=0 按 1 计 */
export function formatLoadPercent(load: unknown, cores: unknown): string {
  const c = Math.max(toFiniteNumber(cores), 1)
  return `${roundTo(clamp(toPercent(load, c), 0, 999), 0)}%`
}

/** 负载原始值 → 两位小数（如 '0.19'） */
export function formatLoad(load: unknown, decimals = 2): string {
  return roundTo(toFiniteNumber(load), decimals).toFixed(decimals)
}

/** 延迟（ms）→ 整数毫秒；null/undefined/负数 → '—'（负数＝丢包，同旧主题语义） */
export function formatLatency(ms: unknown): string {
  const v = toFiniteNumber(ms, Number.NaN)
  if (!Number.isFinite(v) || v < 0)
    return '—'
  return `${Math.round(v)}ms`
}

/** 计数 → 千分位字符串 */
export function formatCount(n: unknown): string {
  const v = Math.round(toFiniteNumber(n))
  return v.toLocaleString('en-US')
}

/** 使用率等级 → 语义状态类（卡片着色/状态点用） */
export type UsageLevel = 'ok' | 'warn' | 'crit'

export function usageLevel(pct: unknown, warn = 70, crit = 90): UsageLevel {
  const p = toFiniteNumber(pct)
  if (p >= crit)
    return 'crit'
  if (p >= warn)
    return 'warn'
  return 'ok'
}
