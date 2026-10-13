import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HistoryChart from '@/v2/components/HistoryChart.vue'
import PingChart from '@/v2/components/PingChart.vue'
import { buildLoadSeries, buildSeries, emptySeries } from '@/v2/data/history'

const history = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'fixtures', 'history.sample.json'), 'utf8'),
) as {
  target_uuid: string
  ping: { records: Record<string, unknown>[] }
  load: { records: Record<string, Record<string, unknown>[]> }
}

function flatSeries(v: number) {
  return buildSeries([
    { time: '2026-10-11T10:00:00Z', value: v },
    { time: '2026-10-11T10:00:10Z', value: v },
  ])
}

describe('HistoryChart：空 / 单点 / 多点三态渲染', () => {
  it('空数据 → 显示占位块，不渲染 SVG', () => {
    const w = mount(HistoryChart, { props: { series: emptySeries(), title: 'CPU' } })
    expect(w.find('[data-testid="chart-empty"]').exists()).toBe(true)
    expect(w.find('svg').exists()).toBe(false)
    expect(w.attributes('data-empty')).toBe('true')
  })

  it('单点 → 画方块点、无线条，且不显示空态', () => {
    const series = buildSeries([{ time: '2026-10-11T10:00:00Z', value: 7 }])
    const w = mount(HistoryChart, { props: { series } })
    expect(w.find('[data-testid="chart-empty"]').exists()).toBe(false)
    expect(w.attributes('data-single')).toBe('true')
    expect(w.findAll('.vk-chart-line').length).toBe(0)
    expect(w.findAll('.vk-chart-dot').length).toBe(1)
  })

  it('多点 → 至少一条曲线 path，路径 d 合法且坐标有限', () => {
    const series = buildSeries([
      { time: '2026-10-11T10:00:00Z', value: 1 },
      { time: '2026-10-11T10:00:10Z', value: 2 },
      { time: '2026-10-11T10:00:20Z', value: 3 },
    ])
    const w = mount(HistoryChart, { props: { series } })
    const paths = w.findAll('.vk-chart-line')
    expect(paths.length).toBeGreaterThanOrEqual(1)
    const d = paths[0]!.attributes('d')!
    expect(d).toMatch(/^M [\d.-]+ [\d.-]+ L /)
    expect(d).not.toMatch(/NaN|Infinity/)
    expect(w.find('[data-testid="chart-axis"]').exists()).toBe(true)
  })

  it('断点 → 渲染多段 curve（断点不连线）', () => {
    const series = buildSeries([
      { time: '2026-10-11T10:00:00Z', value: 10 },
      { time: '2026-10-11T10:00:10Z', value: 20 },
      { time: '2026-10-11T10:00:20Z', value: -1 },
      { time: '2026-10-11T10:00:30Z', value: 30 },
      { time: '2026-10-11T10:00:40Z', value: 40 },
    ])
    const w = mount(HistoryChart, { props: { series } })
    // v-show 未渲染段的 path 仍在 DOM（d 为空过滤后剩两条有效）
    const ds = w.findAll('.vk-chart-line').map(p => p.attributes('d')).filter(Boolean)
    expect(ds).toHaveLength(2)
  })

  it('全等值 → 无 NaN，仍能画线', () => {
    const w = mount(HistoryChart, { props: { series: flatSeries(3) } })
    const d = w.find('.vk-chart-line').attributes('d')!
    expect(d).not.toMatch(/NaN|Infinity/)
  })

  it('真实 load fixture → 渲染曲线', () => {
    const records = history.load.records[history.target_uuid] ?? []
    const series = buildLoadSeries(records, 'cpu')
    const w = mount(HistoryChart, { props: { series, title: 'CPU' } })
    expect(w.find('svg').exists()).toBe(true)
    expect(w.findAll('.vk-chart-line').length).toBeGreaterThan(0)
  })
})

describe('PingChart：延迟曲线（丢包断点）', () => {
  it('真实 ping fixture → 渲染 svg 曲线，带 ms 轴', () => {
    const w = mount(PingChart, { props: { records: history.ping.records, taskId: 1 } })
    expect(w.find('[data-testid="ping-chart"]').exists()).toBe(true)
    expect(w.find('svg').exists()).toBe(true)
    expect(w.find('[data-testid="chart-axis"]').text()).toContain('ms')
  })

  it('空记录 → 占位', () => {
    const w = mount(PingChart, { props: { records: [] } })
    expect(w.find('[data-testid="chart-empty"]').exists()).toBe(true)
  })
})

describe('chart.css：手绘平滑取色契约（母板令牌，无裸 hex）', () => {
  it('不含裸 hex，已去 crispEdges 硬边，取色走 var(--vk-*)', () => {
    const raw = readFileSync(resolve(__dirname, '..', '..', 'src', 'styles', 'v2', 'chart.css'), 'utf8')
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toContain('crispEdges')      // 平滑笔触：无硬边渲染
    expect(css).toMatch(/var\(--vk-/)            // 取色一律经母板令牌（新口径下不再限定某个具体令牌）
  })
})
