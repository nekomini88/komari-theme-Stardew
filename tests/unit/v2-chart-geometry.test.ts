import { describe, expect, it } from 'vitest'
import {
  buildChartModel,
  buildSeries,
  emptySeries,
  gridLines,
  toPathD,
} from '@/v2/data/history'

const W = 220
const H = 64
const PAD = 6

function seriesFrom(values: number[]): ReturnType<typeof buildSeries> {
  return buildSeries(values.map((v, i) => ({
    time: new Date(Date.UTC(2026, 9, 11, 10, 0, i * 10)).toISOString(),
    value: v,
  })))
}

describe('buildChartModel：路径点变换边界', () => {
  it('空数据 → empty=true，无点/段，min/max 归零', () => {
    const m = buildChartModel(emptySeries(), { width: W, height: H })
    expect(m.empty).toBe(true)
    expect(m.single).toBe(false)
    expect(m.points).toEqual([])
    expect(m.segments).toEqual([])
    expect(m.min).toBe(0)
    expect(m.max).toBe(0)
    expect(m.count).toBe(0)
  })

  it('null/undefined 序列安全 → empty', () => {
    expect(buildChartModel(null, { width: W, height: H }).empty).toBe(true)
    expect(buildChartModel(undefined, { width: W, height: H }).empty).toBe(true)
  })

  it('单点 → single=true，横向居中、垂直中线，且所有坐标有限', () => {
    const s = buildSeries([{ time: '2026-10-11T10:00:00Z', value: 42 }])
    const m = buildChartModel(s, { width: W, height: H, padding: PAD })
    expect(m.single).toBe(true)
    expect(m.count).toBe(1)
    expect(m.points).toHaveLength(1)
    const p = m.points[0]!
    expect(p.x).toBe(PAD + (W - PAD * 2) / 2) // tSpan=0 → 居中，防除零
    expect(p.y).toBe(PAD + (H - PAD * 2) / 2) // span=0 → 中线
    expect(Number.isFinite(p.x)).toBe(true)
    expect(Number.isFinite(p.y)).toBe(true)
    // 单点不应产生可用于画线的 path
    expect(m.segments.every(seg => seg.length < 2)).toBe(true)
    expect(toPathD(m.segments[0] ?? [])).toBe('')
  })

  it('断点（null）→ 曲线切段，不跨断点连线', () => {
    const s = buildSeries([
      { time: '2026-10-11T10:00:00Z', value: 10 },
      { time: '2026-10-11T10:00:10Z', value: 20 },
      { time: '2026-10-11T10:00:20Z', value: -1 }, // 丢包 → null
      { time: '2026-10-11T10:00:30Z', value: 30 },
      { time: '2026-10-11T10:00:40Z', value: 40 },
    ])
    const m = buildChartModel(s, { width: W, height: H })
    expect(m.empty).toBe(false)
    expect(m.count).toBe(4)
    expect(m.segments).toHaveLength(2)
    expect(m.segments[0]!.map(p => p.v)).toEqual([10, 20])
    expect(m.segments[1]!.map(p => p.v)).toEqual([30, 40])
    // 每段都能生成合法 path
    for (const seg of m.segments)
      expect(toPathD(seg)).toMatch(/^M [\d.-]+ [\d.-]+ L /)
  })

  it('数值全相等 → 所有点落在同一水平中线（防除零）', () => {
    const m = buildChartModel(seriesFrom([5, 5, 5, 5]), { width: W, height: H, padding: PAD })
    const yMid = PAD + (H - PAD * 2) / 2
    for (const p of m.points) {
      expect(p.y).toBeCloseTo(yMid, 6)
      expect(Number.isFinite(p.y)).toBe(true)
    }
    expect(m.min).toBe(5)
    expect(m.max).toBe(5)
  })

  it('极值差异巨大 → 线性映射，无 NaN/Infinity，y 落在画布内', () => {
    const m = buildChartModel(seriesFrom([0, 1e12, 1e-9]), { width: W, height: H, padding: PAD })
    for (const p of m.points) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
      expect(p.y).toBeGreaterThanOrEqual(PAD - 1e-6)
      expect(p.y).toBeLessThanOrEqual(H - PAD + 1e-6)
      expect(p.x).toBeGreaterThanOrEqual(PAD - 1e-6)
      expect(p.x).toBeLessThanOrEqual(W - PAD + 1e-6)
    }
    expect(m.min).toBe(0)
    expect(m.max).toBe(1e12)
  })

  it('画布宽/高为 0 → 仍返回有限坐标，不产生 NaN', () => {
    const m = buildChartModel(seriesFrom([1, 2, 3]), { width: 0, height: 0 })
    for (const p of m.points) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })

  it('时间升序：x 单调不减', () => {
    const m = buildChartModel(seriesFrom([3, 1, 2, 4]), { width: W, height: H })
    for (let i = 1; i < m.points.length; i++)
      expect(m.points[i]!.x).toBeGreaterThanOrEqual(m.points[i - 1]!.x)
  })
})

describe('toPathD / gridLines 辅助', () => {
  it('toPathD：不足 2 点 → 空串；2 点 → M…L…', () => {
    expect(toPathD([])).toBe('')
    expect(toPathD([{ x: 1, y: 2, t: 0, v: 0 }])).toBe('')
    expect(toPathD([{ x: 1, y: 2, t: 0, v: 0 }, { x: 3, y: 4, t: 1, v: 1 }]))
      .toBe('M 1 2 L 3 4')
  })

  it('gridLines：count=n 返回 n-1 条、全部落在画布竖直范围内', () => {
    const m = buildChartModel(seriesFrom([0, 10]), { width: W, height: H, padding: PAD })
    const g = gridLines(m, 4)
    expect(g).toHaveLength(3)
    for (let i = 1; i < g.length; i++)
      expect(g[i]!).toBeGreaterThan(g[i - 1]!)
    expect(Math.min(...g)).toBeGreaterThan(PAD)
    expect(Math.max(...g)).toBeLessThan(H - PAD)
  })
})
