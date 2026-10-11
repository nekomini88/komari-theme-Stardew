import type { Node, RawClient, RawStatus } from '@/v2/data/types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildOverviewStats, ramPercentText } from '@/v2/data/overviewStats'
import { buildNodes } from '@/v2/data/nodeModel'
import { formatBytes, formatPercent, roundTo } from '@/v2/data/metrics'

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'fixtures', 'clients.sample.json'), 'utf8'),
) as { nodes: Record<string, RawClient>, statuses: Record<string, RawStatus> }

const fixtureNodes: Node[] = buildNodes(fixture.nodes, fixture.statuses)

/** 造一个最小可用的 Node，便于边界用例 */
function makeNode(over: Partial<Node> = {}): Node {
  return {
    uuid: 'x',
    name: 'n',
    region: '',
    group: '',
    os: '',
    arch: '',
    virtualization: '',
    cpuName: '',
    cpuCores: 1,
    time: '',
    status: 'online',
    online: true,
    hasStatus: true,
    cpu: 0,
    ram: 0,
    ramTotal: 0,
    swap: 0,
    swapTotal: 0,
    disk: 0,
    diskTotal: 0,
    load: 0,
    load5: 0,
    load15: 0,
    temp: 0,
    netIn: 0,
    netOut: 0,
    netTotalUp: 0,
    netTotalDown: 0,
    process: 0,
    connections: 0,
    uptime: 0,
    weight: 0,
    price: 0,
    currency: '',
    trafficLimit: 0,
    trafficLimitType: '',
    expiredAt: null,
    ping: {},
    latency: null,
    ...over,
  }
}

describe('buildOverviewStats 边界（0 台 / null / undefined / 缺字段）', () => {
  it('0 台：全零且不抛错', () => {
    const s = buildOverviewStats([])
    expect(s.total).toBe(0)
    expect(s.online).toBe(0)
    expect(s.offline).toBe(0)
    expect(s.unknown).toBe(0)
    expect(s.onlineText).toBe('0 / 0')
    expect(s.cpuText).toBe('0%')
    expect(s.ramText).toBe('0 B / 0 B')
    expect(s.ramPctText).toBe('0%')
    expect(s.diskPctText).toBe('0%')
    expect(s.netInText).toBe('0 B/s')
    expect(s.trafficText).toBe('0 B')
    expect(s.latencyText).toBe('—')
    expect(s.ramPctValue).toBe(0)
  })

  it('null / undefined 与空数组等价', () => {
    expect(buildOverviewStats(null)).toEqual(buildOverviewStats([]))
    expect(buildOverviewStats(undefined)).toEqual(buildOverviewStats([]))
  })

  it('空数组：latencyAvg 为 null，文案为破折号而不是 NaN', () => {
    expect(buildOverviewStats([]).overview.latencyAvg).toBeNull()
    expect(buildOverviewStats([]).latencyText).toBe('—')
  })
})

describe('buildOverviewStats 计数（全部离线 / 混合 / unknown）', () => {
  it('全部离线：online=0，offline=总数，onlineText=0 / N', () => {
    const nodes = [makeNode({ online: false }), makeNode({ online: false })]
    const s = buildOverviewStats(nodes)
    expect(s.total).toBe(2)
    expect(s.online).toBe(0)
    expect(s.offline).toBe(2)
    expect(s.unknown).toBe(0)
    expect(s.onlineText).toBe('0 / 2')
  })

  it('无状态节点计入 unknown，不误算为 offline', () => {
    const nodes = [
      makeNode({ online: true }),
      makeNode({ online: true }),
      makeNode({ hasStatus: false, online: false }),
    ]
    const s = buildOverviewStats(nodes)
    expect(s.total).toBe(3)
    expect(s.online).toBe(2)
    expect(s.unknown).toBe(1)
    expect(s.offline).toBe(0)
  })
})

describe('buildOverviewStats 真实 fixture（聚合 → 格式化）', () => {
  const s = buildOverviewStats(fixtureNodes)

  it('总数/在线数与 fixture 一致', () => {
    expect(s.total).toBe(Object.keys(fixture.nodes).length)
    expect(s.online).toBe(fixtureNodes.filter(n => n.online).length)
    expect(s.onlineText).toBe(`${s.online} / ${s.total}`)
  })

  it('CPU 均值只对有状态节点求平均，文案带 %', () => {
    const o = s.overview
    expect(s.cpuText).toBe(`${roundTo(o.cpuAvg, 1)}%`)
    expect(s.cpuText).toMatch(/%$/)
  })

  it('内存/硬盘文案经 metrics 格式化（used / total）', () => {
    expect(s.ramText).toBe(`${formatBytes(s.overview.ramUsed)} / ${formatBytes(s.overview.ramTotal)}`)
    expect(s.diskPctText).toBe(formatPercent(s.overview.diskUsed, s.overview.diskTotal))
    expect(s.ramPctText).toBe(formatPercent(s.overview.ramUsed, s.overview.ramTotal))
    expect(ramPercentText(s.overview)).toBe(formatPercent(s.overview.ramUsed, s.overview.ramTotal))
  })

  it('总流量 = 累计上行 + 累计下行', () => {
    expect(s.overview.trafficTotal).toBe(s.overview.netTotalUp + s.overview.netTotalDown)
    expect(s.trafficText).toBe(formatBytes(s.overview.trafficTotal))
  })
})
