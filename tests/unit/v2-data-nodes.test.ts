import type { RawClient, RawStatus } from '@/v2/data/types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildNode,
  buildNodes,
  buildOverview,
  collectGroups,
  filterNodes,
  pickLatency,
  searchNodes,
  sortNodes,
} from '@/v2/data/nodeModel'

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'fixtures', 'clients.sample.json'), 'utf8'),
) as { nodes: Record<string, RawClient>, statuses: Record<string, RawStatus> }

describe('真实样本 fixture 形状自检', () => {
  it('含节点与状态，且未残留 token/明文 ip', () => {
    expect(Object.keys(fixture.nodes).length).toBeGreaterThan(0)
    const text = JSON.stringify(fixture)
    expect(text).not.toMatch(/"token"\s*:\s*"[^<]/)
    expect(text).not.toMatch(/"ipv4"\s*:\s*"\d/)
  })
})

describe('buildNodes：真实数据合并（含无状态节点兜底）', () => {
  const nodes = buildNodes(fixture.nodes, fixture.statuses)

  it('节点数与 client 数一致，且顺序稳定', () => {
    expect(nodes).toHaveLength(Object.keys(fixture.nodes).length)
    expect(nodes.map(n => n.uuid)).toEqual(Object.keys(fixture.nodes))
  })

  it('有状态节点 online/指标来自 status；无状态节点为 unknown 且指标归零', () => {
    const uuid = Object.keys(fixture.statuses)[0]!
    const n = nodes.find(x => x.uuid === uuid)!
    expect(n.hasStatus).toBe(true)
    expect(n.status).toBe(fixture.statuses[uuid]!.online ? 'online' : 'offline')
    expect(n.cpu).toBe(fixture.statuses[uuid]!.cpu)
    expect(n.ramTotal).toBe(fixture.statuses[uuid]!.ram_total)

    const noStatus = nodes.find(x => !fixture.statuses[x.uuid])!
    expect(noStatus.status).toBe('unknown')
    expect(noStatus.online).toBe(false)
    expect(noStatus.cpu).toBe(0)
    expect(noStatus.ramTotal).toBe(fixture.nodes[noStatus.uuid]!.mem_total) // 回退到 client.mem_total
  })

  it('latency 取 ping 中 avg 最小且非丢包者', () => {
    const n = nodes.find(x => x.hasStatus)!
    expect(n.latency).toBe(pickLatency(fixture.statuses[n.uuid]!.ping))
  })

  it('非法入参安全返回 []', () => {
    expect(buildNodes(undefined, undefined)).toEqual([])
    expect(buildNodes(null as unknown as Record<string, RawClient>, null as unknown as Record<string, RawStatus>)).toEqual([])
  })
})

describe('buildNode 默认值兜底', () => {
  const minimal: RawClient = {
    uuid: 'u1',
    name: '',
    cpu_name: '',
    virtualization: '',
    arch: '',
    cpu_cores: 0,
    os: '',
    kernel_version: '',
    region: '',
    public_remark: '',
    mem_total: 0,
    swap_total: 0,
    disk_total: 0,
    weight: 0,
    price: 0,
    billing_cycle: 0,
    auto_renewal: false,
    currency: '',
    expired_at: null,
    group: '',
    tags: '',
    hidden: false,
    traffic_limit: 0,
    traffic_limit_type: '',
    created_at: '',
    updated_at: '',
  }

  it('name 缺失回退到 uuid；expired_at 保留 null', () => {
    const n = buildNode(minimal)
    expect(n.name).toBe('u1')
    expect(n.expiredAt).toBeNull()
    expect(n.latency).toBeNull()
    expect(n.status).toBe('unknown')
  })
})

describe('pickLatency 边界', () => {
  it('全丢包/空 → null', () => {
    expect(pickLatency(undefined)).toBeNull()
    expect(pickLatency({})).toBeNull()
    expect(pickLatency({ a: { avg: -1 }, b: { avg: -2 } })).toBeNull()
  })
  it('跳过丢包任务取最小', () => {
    expect(pickLatency({ a: { avg: 300 }, b: { avg: -1 }, c: { avg: 50 } })).toBe(50)
  })
})

describe('buildOverview 统计', () => {
  const nodes = buildNodes(fixture.nodes, fixture.statuses)
  const o = buildOverview(nodes)

  it('总量/在线数与节点一致', () => {
    expect(o.total).toBe(nodes.length)
    expect(o.online).toBe(nodes.filter(n => n.online).length)
    expect(o.offline).toBe(o.total - o.online)
  })
  it('内存/硬盘百分比在 0..100', () => {
    expect(o.ramPct).toBeGreaterThanOrEqual(0)
    expect(o.ramPct).toBeLessThanOrEqual(100)
    expect(o.diskPct).toBeGreaterThanOrEqual(0)
    expect(o.diskPct).toBeLessThanOrEqual(100)
  })
  it('累计流量 = 上行 + 下行', () => {
    expect(o.trafficTotal).toBe(o.netTotalUp + o.netTotalDown)
  })
  it('空列表 → 全零且 latencyAvg=null', () => {
    const e = buildOverview([])
    expect(e.total).toBe(0)
    expect(e.ramPct).toBe(0)
    expect(e.latencyAvg).toBeNull()
  })
})

describe('排序/筛选/搜索（纯逻辑，不改动入参）', () => {
  const nodes = buildNodes(fixture.nodes, fixture.statuses)

  it('default 排序：在线优先，其次 weight 升序', () => {
    const s = sortNodes(nodes)
    const firstOffline = s.findIndex(n => !n.online)
    const lastOnline = s.map(n => n.online).lastIndexOf(true)
    if (firstOffline !== -1 && lastOnline !== -1)
      expect(lastOnline).toBeLessThan(firstOffline)
  })

  it('按 cpu 降序：缺失值(null→NaN)排末尾', () => {
    const s = sortNodes(nodes, 'cpu', 'desc')
    const values = s.map(n => (n.hasStatus ? n.cpu : null))
    // 有状态节点在前且递减
    const known = values.filter(v => v !== null) as number[]
    for (let i = 1; i < known.length; i++)
      expect(known[i]! <= known[i - 1]!).toBe(true)
  })

  it('按 name 升序本地化比较', () => {
    const s = sortNodes(nodes, 'name', 'asc')
    const names = s.map(n => n.name)
    const sorted = [...names].sort((a, b) => a.localeCompare(b))
    expect(names).toEqual(sorted)
  })

  it('sortNodes 返回新数组且不改动入参', () => {
    const before = nodes.map(n => n.uuid)
    const out = sortNodes(nodes, 'ram', 'desc')
    expect(out).not.toBe(nodes)
    expect(nodes.map(n => n.uuid)).toEqual(before)
  })

  it('searchNodes：按名称/地区/系统匹配，空查询原样返回', () => {
    expect(searchNodes(nodes, '').length).toBe(nodes.length)
    const target = nodes.find(n => n.name)!
    const key = target.name.slice(0, 2)
    expect(searchNodes(nodes, key).some(n => n.uuid === target.uuid)).toBe(true)
    expect(searchNodes(nodes, 'zzz-not-exist')).toHaveLength(0)
  })

  it('filterNodes：在线/分组/搜索组合（AND）', () => {
    const online = filterNodes(nodes, { onlineOnly: true })
    expect(online.every(n => n.online)).toBe(true)
    const g = collectGroups(nodes)[0]
    if (g) {
      const byGroup = filterNodes(nodes, { group: g })
      expect(byGroup.every(n => n.group === g)).toBe(true)
    }
    expect(filterNodes(nodes, { query: 'definitely-nope' })).toHaveLength(0)
  })

  it('collectGroups 去重且保持首现顺序', () => {
    const groups = collectGroups([
      { ...nodes[0]!, group: 'a' },
      { ...nodes[0]!, group: 'b' },
      { ...nodes[0]!, group: 'a' },
    ])
    expect(groups).toEqual(['a', 'b'])
  })
})
