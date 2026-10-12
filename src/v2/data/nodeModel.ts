/**
 * 节点模型转换与列表逻辑（纯函数 → 可单测）
 *
 * - buildNodes: 合并 common:getNodes × common:getNodesLatestStatus → Node[]（含默认值兜底）
 * - buildOverview: 顶部总览统计
 * - sortNodes / filterNodes / searchNodes: 排序、筛选、搜索（不改动入参）
 */

import type { Node, NodeStatusLevel, Overview, RawClient, RawStatus, SortDir, SortKey } from './types'
import { toFiniteNumber, toPercent } from './metrics'
import { nodeViewStatus } from './nodeStatus'

const num = (v: unknown) => toFiniteNumber(v)

/** 从 Ping 汇总里取「代表任务」的延迟与丢包（同一任务 → 口径一致）。
 *  取 avg 最小且非丢包的任务；无可用任务 → 两者皆 null。 */
export function pickPingStats(
  ping: Record<string, { avg: number, loss?: number }> | undefined,
): { latency: number | null, loss: number | null } {
  if (!ping)
    return { latency: null, loss: null }
  let best: { avg: number, loss: number } | null = null
  for (const p of Object.values(ping)) {
    const avg = num(p?.avg)
    if (!Number.isFinite(avg) || avg < 0)
      continue
    if (best === null || avg < best.avg)
      best = { avg, loss: num(p?.loss) }
  }
  if (best === null)
    return { latency: null, loss: null }
  return { latency: best.avg, loss: Number.isFinite(best.loss) ? best.loss : null }
}

/** 从 Ping 汇总里取代表延迟：取 avg 最小且非丢包的任务（委托 pickPingStats，保证与丢包同源） */
export function pickLatency(ping: Record<string, { avg: number }> | undefined): number | null {
  return pickPingStats(ping).latency
}

function statusLevel(online: unknown, hasStatus: boolean): NodeStatusLevel {
  if (!hasStatus)
    return 'unknown'
  return online ? 'online' : 'offline'
}

/** 单个节点：client × 可选 status → Node */
export function buildNode(client: RawClient, status?: RawStatus): Node {
  const hasStatus = !!status
  const online = !!status?.online
  /** 代表延迟与丢包同源（同一个 Ping 任务） */
  const pingStats = pickPingStats(status?.ping)
  return {
    uuid: client.uuid,
    name: client.name || client.uuid,
    region: client.region || '',
    group: client.group || '',
    os: client.os || '',
    arch: client.arch || '',
    virtualization: client.virtualization || '',
    cpuName: client.cpu_name || '',
    cpuCores: num(client.cpu_cores),
    time: status?.time ?? '',
    status: statusLevel(online, hasStatus),
    online,
    hasStatus,
    cpu: num(status?.cpu),
    ram: num(status?.ram),
    ramTotal: num(status?.ram_total) || num(client.mem_total),
    swap: num(status?.swap),
    swapTotal: num(status?.swap_total) || num(client.swap_total),
    disk: num(status?.disk),
    diskTotal: num(status?.disk_total) || num(client.disk_total),
    load: num(status?.load),
    load5: num(status?.load5),
    load15: num(status?.load15),
    temp: num(status?.temp),
    netIn: num(status?.net_in),
    netOut: num(status?.net_out),
    netTotalUp: num(status?.net_total_up),
    netTotalDown: num(status?.net_total_down),
    process: num(status?.process),
    connections: num(status?.connections),
    uptime: num(status?.uptime),
    weight: num(client.weight),
    price: num(client.price),
    currency: client.currency || '',
    trafficLimit: num(client.traffic_limit),
    trafficLimitType: client.traffic_limit_type || '',
    expiredAt: client.expired_at ?? null,
    ping: status?.ping ?? {},
    latency: pingStats.latency,
    loss: pingStats.loss,
  }
}

/**
 * 合并两接口 → Node[]；保持 client 的插入顺序，无状态者 status='unknown'。
 * 入参非法（undefined/null）时安全返回 []。
 */
export function buildNodes(
  clients: Record<string, RawClient> | null | undefined,
  statuses: Record<string, RawStatus> | null | undefined,
): Node[] {
  if (!clients || typeof clients !== 'object')
    return []
  const s = statuses && typeof statuses === 'object' ? statuses : {}
  return Object.values(clients).map(c => buildNode(c, s[c.uuid]))
}

/** 顶部总览统计（对全部节点求和/平均，纯函数） */
export function buildOverview(nodes: readonly Node[] | null | undefined): Overview {
  const list = Array.isArray(nodes) ? nodes : []
  let online = 0
  let cpuSum = 0
  let cpuCount = 0
  let ramUsed = 0
  let ramTotal = 0
  let diskUsed = 0
  let diskTotal = 0
  let netIn = 0
  let netOut = 0
  let netTotalUp = 0
  let netTotalDown = 0
  let latencySum = 0
  let latencyCount = 0

  for (const n of list) {
    if (n.online)
      online++
    if (n.hasStatus) {
      cpuSum += n.cpu
      cpuCount++
    }
    ramUsed += n.ram
    ramTotal += n.ramTotal
    diskUsed += n.disk
    diskTotal += n.diskTotal
    netIn += n.netIn
    netOut += n.netOut
    netTotalUp += n.netTotalUp
    netTotalDown += n.netTotalDown
    if (n.latency !== null && Number.isFinite(n.latency)) {
      latencySum += n.latency
      latencyCount++
    }
  }

  return {
    total: list.length,
    online,
    offline: list.length - online,
    cpuAvg: cpuCount ? cpuSum / cpuCount : 0,
    ramUsed,
    ramTotal,
    ramPct: toPercent(ramUsed, ramTotal),
    diskUsed,
    diskTotal,
    diskPct: toPercent(diskUsed, diskTotal),
    netIn,
    netOut,
    netTotalUp,
    netTotalDown,
    trafficTotal: netTotalUp + netTotalDown,
    latencyAvg: latencyCount ? latencySum / latencyCount : null,
  }
}

/** 搜索：名称/分组/地区/系统/描述（大小写不敏感）；空查询 → 原样返回 */
export function searchNodes(nodes: readonly Node[] | null | undefined, query: string): Node[] {
  const list = Array.isArray(nodes) ? nodes : []
  const q = (query ?? '').trim().toLowerCase()
  if (!q)
    return [...list]
  return list.filter(n => [n.name, n.group, n.region, n.os, n.arch, n.uuid]
    .some(f => (f ?? '').toLowerCase().includes(q)))
}

export interface FilterOptions {
  /** 只看在线 */
  onlineOnly?: boolean
  /** 分组名（精确匹配，空表示全部） */
  group?: string
  /** 附加搜索词 */
  query?: string
  /** 状态筛选：all 不筛 / online(纯在线) / alert(在线但资源告警) / offline(有状态但离线) / unknown(无状态) */
  status?: StatusFilter
}

/**
 * 状态筛选项（与 UI 控件一一对应）。
 * 与卡片四档状态（nodeStatus.ts 的 NodeViewStatus）对齐：online/alert/offline/unknown 互斥，
 * 外加 all 表示不筛。
 */
export type StatusFilter = 'all' | 'online' | 'alert' | 'offline' | 'unknown'

export const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: '全部',
  online: '在线',
  alert: '告警',
  offline: '离线',
  unknown: '未知',
}

/**
 * 状态筛选（纯函数）：all 原样返回；其余直接以 nodeViewStatus 为单一事实来源，
 * 禁止再自行拼 online/hasStatus 判定，避免与卡片「在线/告警/离线/未知」口径分叉。
 */
export function filterByStatus(nodes: readonly Node[] | null | undefined, status: StatusFilter): Node[] {
  const list = Array.isArray(nodes) ? nodes : []
  if (!status || status === 'all')
    return [...list]
  return list.filter(n => nodeViewStatus(n) === status)
}

/** 筛选：在线 / 分组 / 搜索 / 状态组合（AND） */
export function filterNodes(nodes: readonly Node[] | null | undefined, opts: FilterOptions = {}): Node[] {
  let list = searchNodes(nodes, opts.query ?? '')
  if (opts.onlineOnly)
    list = list.filter(n => n.online)
  if (opts.group)
    list = list.filter(n => n.group === opts.group)
  if (opts.status && opts.status !== 'all')
    list = filterByStatus(list, opts.status)
  return list
}

/** 排序取值器 */
function sortValue(n: Node, key: SortKey): number | string | null {
  switch (key) {
    case 'name': return n.name
    case 'cpu': return n.cpu
    case 'ram': return toPercent(n.ram, n.ramTotal)
    case 'disk': return toPercent(n.disk, n.diskTotal)
    case 'traffic': return n.netTotalUp + n.netTotalDown
    case 'load': return n.load
    case 'latency': return n.latency
    default: return n.weight
  }
}

/**
 * 排序（返回新数组，不改动入参）：
 *  - 默认 default：在线优先，其次 weight 升序
 *  - 其它键：缺失值(null/NaN)恒排末尾；name 走本地化比较；其余数值比较
 */
export function sortNodes(
  nodes: readonly Node[] | null | undefined,
  key: SortKey = 'default',
  dir: SortDir = 'asc',
): Node[] {
  const list = Array.isArray(nodes) ? [...nodes] : []
  const sign = dir === 'desc' ? -1 : 1

  if (key === 'default') {
    return list.sort((a, b) => {
      if (a.online !== b.online)
        return a.online ? -1 : 1
      return a.weight - b.weight
    })
  }

  return list.sort((a, b) => {
    const av = sortValue(a, key)
    const bv = sortValue(b, key)
    const aMissing = av === null || (typeof av === 'number' && !Number.isFinite(av))
    const bMissing = bv === null || (typeof bv === 'number' && !Number.isFinite(bv))
    if (aMissing && bMissing)
      return 0
    if (aMissing)
      return 1
    if (bMissing)
      return -1
    if (typeof av === 'string' && typeof bv === 'string')
      return av.localeCompare(bv) * sign
    return ((av as number) - (bv as number)) * sign
  })
}

/** 分组去重列表（保持首次出现顺序） */
export function collectGroups(nodes: readonly Node[] | null | undefined): string[] {
  const list = Array.isArray(nodes) ? nodes : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const n of list) {
    if (n.group && !seen.has(n.group)) {
      seen.add(n.group)
      out.push(n.group)
    }
  }
  return out
}
