/**
 * 顶部总览统计（纯函数 → 可单测）
 *
 * 在 nodeModel.buildOverview（数值汇聚）之上加一层「展示就绪」视图模型：
 * 所有文案统一走 metrics.ts 的格式化函数，组件不再自行拼字符串。
 *
 * 边界：nodes 为 null / undefined / [] → 全零且不抛错；缺字段/NaN 由 metrics 兜底。
 */

import type { Node, Overview } from './types'
import {
  formatBytes,
  formatBytesPerSecond,
  formatLatency,
  formatPercent,
  percentValue,
  roundTo,
} from './metrics'
import { buildOverview } from './nodeModel'

export interface OverviewStats {
  total: number
  online: number
  offline: number
  unknown: number
  /** 如 '4 / 6' */
  onlineText: string
  /** 有状态节点的平均 CPU，如 '6.2%' */
  cpuText: string
  /** 如 '1.2 GB / 8.4 GB' */
  ramText: string
  ramPctText: string
  ramPctValue: number
  diskText: string
  diskPctText: string
  diskPctValue: number
  netInText: string
  netOutText: string
  /** 累计上下行总量，如 '12.3 GB' */
  trafficText: string
  /** 平均延迟，如 '34ms'；无样本 → '—' */
  latencyText: string
  /** 原始数值汇聚结果，供图表/进度条复用 */
  overview: Overview
}

/** 节点数组 → 顶部总览展示模型（永不抛错） */
export function buildOverviewStats(nodes: readonly Node[] | null | undefined): OverviewStats {
  const list = Array.isArray(nodes) ? nodes.filter(n => !!n) : []
  const o = buildOverview(list)

  let online = 0
  let unknown = 0
  for (const n of list) {
    if (n.online)
      online++
    if (!n.hasStatus)
      unknown++
  }
  const offline = Math.max(list.length - online - unknown, 0)

  return {
    total: list.length,
    online,
    offline,
    unknown,
    onlineText: `${online} / ${list.length}`,
    cpuText: `${roundTo(o.cpuAvg, 1)}%`,
    ramText: `${formatBytes(o.ramUsed)} / ${formatBytes(o.ramTotal)}`,
    ramPctText: `${roundTo(o.ramPct, 1)}%`,
    ramPctValue: percentValue(o.ramUsed, o.ramTotal),
    diskText: `${formatBytes(o.diskUsed)} / ${formatBytes(o.diskTotal)}`,
    diskPctText: `${roundTo(o.diskPct, 1)}%`,
    diskPctValue: percentValue(o.diskUsed, o.diskTotal),
    netInText: formatBytesPerSecond(o.netIn),
    netOutText: formatBytesPerSecond(o.netOut),
    trafficText: formatBytes(o.trafficTotal),
    latencyText: o.latencyAvg === null ? '—' : formatLatency(o.latencyAvg),
    overview: o,
  }
}

/** 便于断言/展示：总览里的内存占比文案（等价于 formatPercent(used,total)） */
export function ramPercentText(o: Overview): string {
  return formatPercent(o.ramUsed, o.ramTotal)
}
