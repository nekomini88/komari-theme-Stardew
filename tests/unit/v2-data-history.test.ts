import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildLoadSeries, buildPingSeries, buildSeries, emptySeries, normalizeSeries, timeToMs } from '@/v2/data/history'

const history = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'fixtures', 'history.sample.json'), 'utf8'),
) as {
  target_uuid: string
  ping: { records: Record<string, unknown>[] }
  load: { records: Record<string, unknown[]> }
  recent: { records: Record<string, unknown>[] }
}

describe('timeToMs', () => {
  it('合法 ISO → 数字；非法 → NaN', () => {
    expect(Number.isFinite(timeToMs('2026-10-11T09:58:00Z'))).toBe(true)
    expect(timeToMs('')).toBeNaN()
    expect(timeToMs('not-a-date')).toBeNaN()
    expect(timeToMs(undefined)).toBeNaN()
  })
})

describe('buildSeries：空/单点/断点/乱序', () => {
  it('空数据 → 空序列（min/max 归零）', () => {
    const s = buildSeries([])
    expect(s).toEqual(emptySeries())
    expect(s.min).toBe(0)
    expect(s.max).toBe(0)
    expect(s.count).toBe(0)
    expect(buildSeries(null)).toEqual(emptySeries())
  })

  it('单点 → 一个有效点，min=max=v', () => {
    const s = buildSeries([{ time: '2026-10-11T09:58:00Z', value: 42 }])
    expect(s.points).toHaveLength(1)
    expect(s.count).toBe(1)
    expect(s.min).toBe(42)
    expect(s.max).toBe(42)
  })

  it('value<0 → 缺口(null)，不计入 min/max', () => {
    const s = buildSeries([
      { time: '2026-10-11T09:58:00Z', value: 10 },
      { time: '2026-10-11T09:58:10Z', value: -1 },
      { time: '2026-10-11T09:58:20Z', value: 30 },
    ])
    expect(s.points.map(p => p.v)).toEqual([10, null, 30])
    expect(s.count).toBe(2)
    expect(s.min).toBe(10)
    expect(s.max).toBe(30)
  })

  it('时间跳跃超过中位间隔×factor → 插入断点', () => {
    const s = buildSeries([
      { time: '2026-10-11T09:58:00Z', value: 1 },
      { time: '2026-10-11T09:58:10Z', value: 2 },
      { time: '2026-10-11T10:20:00Z', value: 3 }, // 大跳跃
      { time: '2026-10-11T10:20:10Z', value: 4 },
    ])
    const nullCount = s.points.filter(p => p.v === null).length
    expect(nullCount).toBe(2)
  })

  it('乱序输入按时间升序排列', () => {
    const s = buildSeries([
      { time: '2026-10-11T09:58:20Z', value: 3 },
      { time: '2026-10-11T09:58:00Z', value: 1 },
      { time: '2026-10-11T09:58:10Z', value: 2 },
    ])
    expect(s.points.map(p => p.v)).toEqual([1, 2, 3])
  })

  it('gapFactor<=1 关闭断点检测', () => {
    const s = buildSeries([
      { time: '2026-10-11T09:58:00Z', value: 1 },
      { time: '2026-10-11T10:58:00Z', value: 2 },
    ], { gapFactor: 1 })
    expect(s.points.every(p => p.v !== null)).toBe(true)
  })
})

describe('真实样本序列构建', () => {
  it('ping 序列：抽取 task 1，值域合理', () => {
    const s = buildPingSeries(history.ping.records, 1)
    expect(s.count).toBeGreaterThan(0)
    expect(s.max).toBeGreaterThan(0)
    expect(s.min).toBeLessThanOrEqual(s.max)
  })

  it('ping 全量（不指定 task）', () => {
    const s = buildPingSeries(history.ping.records)
    expect(s.count).toBeGreaterThan(0)
  })

  it('load 序列：抽取 cpu 字段', () => {
    const records = history.load.records[history.target_uuid] ?? []
    const s = buildLoadSeries(records as Record<string, unknown>[], 'cpu')
    expect(s.count).toBeGreaterThan(0)
    expect(s.min).toBeGreaterThanOrEqual(0)
  })

  it('recent 序列：抽取 ram', () => {
    const s = buildLoadSeries(history.recent.records, 'ram')
    expect(s.count).toBeGreaterThan(0)
  })
})

describe('normalizeSeries 归一化', () => {
  it('空 → []；等值序列归到 0.5 中线', () => {
    expect(normalizeSeries(emptySeries())).toEqual([])
    const flat = buildSeries([
      { time: '2026-10-11T09:58:00Z', value: 5 },
      { time: '2026-10-11T09:58:10Z', value: 5 },
    ])
    expect(normalizeSeries(flat).map(p => p.y)).toEqual([0.5, 0.5])
  })
  it('有跨度 → 归一化到 0..1，缺口保留 null', () => {
    const s = buildSeries([
      { time: '2026-10-11T09:58:00Z', value: 0 },
      { time: '2026-10-11T09:58:10Z', value: 10 },
      { time: '2026-10-11T09:58:20Z', value: -1 },
    ])
    const n = normalizeSeries(s)
    expect(n[0]!.y).toBe(0)
    expect(n[1]!.y).toBe(1)
    expect(n[2]!.y).toBeNull()
  })
})
