import { describe, expect, it } from 'vitest'
import {
  clamp,
  formatBytes,
  formatBytesPerSecond,
  formatBytesSplit,
  formatCount,
  formatLatency,
  formatLoad,
  formatLoadPercent,
  formatPercent,
  formatUptime,
  percentValue,
  roundTo,
  toFiniteNumber,
  toPercent,
  usageLevel,
} from '@/v2/data/metrics'

describe('指标格式化：非法输入兜底（0 / null / undefined / NaN / Infinity / 负数）', () => {
  it('toFiniteNumber 归一化任何非有限值', () => {
    expect(toFiniteNumber(0)).toBe(0)
    expect(toFiniteNumber(null)).toBe(0)
    expect(toFiniteNumber(undefined)).toBe(0)
    expect(toFiniteNumber(Number.NaN)).toBe(0)
    expect(toFiniteNumber(Number.POSITIVE_INFINITY)).toBe(0)
    expect(toFiniteNumber(-5)).toBe(-5)
    expect(toFiniteNumber('12.5')).toBe(12.5)
    expect(toFiniteNumber('abc', 7)).toBe(7)
    expect(toFiniteNumber(Number.NaN, 7)).toBe(7)
  })

  it('formatBytes: 0/负/null → 0 B', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(null)).toBe('0 B')
    expect(formatBytes(undefined)).toBe('0 B')
    expect(formatBytes(-1)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
  })

  it('formatBytes: 单位切换与保留位数', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1024 ** 2)).toBe('1.0 MB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1024, 0)).toBe('1 KB')
    expect(formatBytes(1536, 3)).toBe('1.500 KB')
  })

  it('formatBytes: 超大值升到 EB 不再溢出', () => {
    expect(formatBytes(1024 ** 6)).toBe('1.0 EB')
    expect(formatBytes(1024 ** 9)).toBe(`${1024 ** 3}.0 EB`) // 超过最高单位时钳制在 EB，数值继续放大
    expect(formatBytes(Number.MAX_SAFE_INTEGER, 0)).toBe('8 PB')
  })

  it('formatBytesSplit 返回数值/单位对，速率带 /s', () => {
    expect(formatBytesSplit(0)).toEqual({ value: '0', unit: 'B' })
    expect(formatBytesSplit(2048)).toEqual({ value: '2.0', unit: 'KB' })
    expect(formatBytesPerSecond(1024)).toBe('1.0 KB/s')
  })

  it('toPercent / formatPercent：total<=0 或非法 → 0', () => {
    expect(toPercent(50, 100)).toBe(50)
    expect(toPercent(1, 0)).toBe(0)
    expect(toPercent(null, null)).toBe(0)
    expect(toPercent(200, 100)).toBe(100) // 钳制上限
    expect(toPercent(-10, 100)).toBe(0) // 钳制下限
    expect(formatPercent(1, 3, 1)).toBe('33.3%')
    expect(formatPercent(1, 3, 0)).toBe('33%')
    expect(percentValue(1, 3, 2)).toBe(33.33)
  })

  it('roundTo 抑制浮点尾巴并钳制位数', () => {
    expect(roundTo(0.1 + 0.2, 2)).toBe(0.3)
    expect(roundTo(1.005, 2)).toBe(1.01)
    expect(roundTo(3.7, 0)).toBe(4)
    expect(roundTo(1.23456789, 99)).toBe(1.234568) // decimals 上限 6
  })

  it('formatUptime：0/负 → —，否则紧凑格式', () => {
    expect(formatUptime(0)).toBe('—')
    expect(formatUptime(-1)).toBe('—')
    expect(formatUptime(null)).toBe('—')
    expect(formatUptime(45)).toBe('45s')
    expect(formatUptime(90)).toBe('1m')
    expect(formatUptime(3600)).toBe('1h 0m')
    expect(formatUptime(90000)).toBe('1d 1h')
  })

  it('formatLatency：负数/null → —（丢包语义）', () => {
    expect(formatLatency(23.7)).toBe('24ms')
    expect(formatLatency(0)).toBe('0ms')
    expect(formatLatency(-1)).toBe('—')
    expect(formatLatency(null)).toBe('—')
    expect(formatLatency(undefined)).toBe('—')
  })

  it('负载/计数格式化', () => {
    expect(formatLoad(0.193, 2)).toBe('0.19')
    expect(formatLoad(null)).toBe('0.00')
    expect(formatLoadPercent(2, 4)).toBe('50%')
    expect(formatLoadPercent(1, 0)).toBe('100%') // cores<=0 按 1 计
    expect(formatCount(1234567)).toBe('1,234,567')
  })

  it('usageLevel 分档', () => {
    expect(usageLevel(10)).toBe('ok')
    expect(usageLevel(70)).toBe('warn')
    expect(usageLevel(90)).toBe('crit')
    expect(usageLevel(null)).toBe('ok')
    expect(clamp(150, 0, 100)).toBe(100)
    expect(clamp(Number.NaN, 3, 9)).toBe(3)
  })
})
