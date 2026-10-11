/**
 * v2 数据层类型（真实接口形状）
 *
 * 真实来源：本地 NekoVPS 实例 /api/rpc2 JSON-RPC(POST)：
 *  - common:getNodes              → Record<uuid, RawClient>
 *  - common:getNodesLatestStatus  → Record<uuid, RawStatus>
 *  - common:getRecords            → 历史负载/Ping
 *  - common:getNodeRecentStatus   → 近 1 分钟采样
 *
 * 注：/api/clients 实际是 WebSocket 端点（HTTP GET 返回 "Require WebSocket upgrade"，
 * 无会话时升级被拒 403），因此 HTTP 数据面统一走 /api/rpc2。真实样本见
 * tests/fixtures/clients.sample.json / history.sample.json。
 */

/** 节点静态信息（common:getNodes 单项） */
export interface RawClient {
  uuid: string
  name: string
  cpu_name: string
  virtualization: string
  arch: string
  cpu_cores: number
  cpu_physical_cores?: number
  os: string
  kernel_version: string
  gpu_name?: string
  ipv4?: string
  ipv6?: string
  region: string
  remark?: string
  public_remark: string
  mem_total: number
  swap_total: number
  disk_total: number
  version?: string
  weight: number
  price: number
  billing_cycle: number
  auto_renewal: boolean
  currency: string
  expired_at: string | null
  group: string
  tags: string
  hidden: boolean
  traffic_limit: number
  traffic_limit_type: string
  created_at: string
  updated_at: string
}

/** 节点实时状态（common:getNodesLatestStatus 单项） */
export interface RawStatus {
  client: string
  time: string
  cpu: number
  gpu: number
  ram: number
  ram_total: number
  swap: number
  swap_total: number
  load: number
  load5: number
  load15: number
  temp: number
  disk: number
  disk_total: number
  net_in: number
  net_out: number
  net_total_up: number
  net_total_down: number
  process: number
  connections: number
  connections_udp: number
  online: boolean
  uptime: number
  ping?: Record<string, RawPing>
}

/** 单条 Ping 任务最新汇总（键为 task_id） */
export interface RawPing {
  name: string
  latest: number
  avg: number
  tail: number
  loss: number
  min: number
  max: number
}

/** 节点在线状态（视图语义） */
export type NodeStatusLevel = 'online' | 'offline' | 'unknown'

/** v2 卡片/列表使用的节点视图模型（纯数据，无响应式） */
export interface Node {
  uuid: string
  name: string
  region: string
  group: string
  os: string
  arch: string
  virtualization: string
  cpuName: string
  cpuCores: number
  /** 最近状态时间戳（ISO），无状态时为空串 */
  time: string
  status: NodeStatusLevel
  online: boolean
  /** 是否曾在状态接口出现过（区分 offline 与 unknown） */
  hasStatus: boolean
  /* 占用类（均为原始单位） */
  cpu: number
  ram: number
  ramTotal: number
  swap: number
  swapTotal: number
  disk: number
  diskTotal: number
  load: number
  load5: number
  load15: number
  temp: number
  /* 网络 */
  netIn: number
  netOut: number
  netTotalUp: number
  netTotalDown: number
  process: number
  connections: number
  uptime: number
  /* 计费/限额 */
  weight: number
  price: number
  currency: string
  trafficLimit: number
  trafficLimitType: string
  expiredAt: string | null
  /** 各 Ping 任务最新延迟（ms） */
  ping: Record<string, RawPing>
  /** 代表延迟（ms）—— 取 avg 最小的任务，<0 视为丢包 */
  latency: number | null
}

/** 顶部总览统计（纯计算结果） */
export interface Overview {
  total: number
  online: number
  offline: number
  cpuAvg: number
  ramUsed: number
  ramTotal: number
  ramPct: number
  diskUsed: number
  diskTotal: number
  diskPct: number
  netIn: number
  netOut: number
  netTotalUp: number
  netTotalDown: number
  trafficTotal: number
  latencyAvg: number | null
}

export type SortKey = 'default' | 'name' | 'cpu' | 'ram' | 'disk' | 'traffic' | 'load' | 'latency'
export type SortDir = 'asc' | 'desc'

/** 序列点（图表用）；v 为 null 表示断点/缺口 */
export interface SeriesPoint {
  t: number
  v: number | null
}

/** 图表序列 */
export interface Series {
  points: SeriesPoint[]
  min: number
  max: number
  /** 有效点数（v !== null） */
  count: number
}
