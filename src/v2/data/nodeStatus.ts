/**
 * 节点视图状态（纯函数 → 可单测）
 *
 * 把「在线/离线/告警/未知」从原始字段推导出来，供卡片用「颜色 + 文字」双重区分
 * （ART_SYSTEM §1.4：禁止只靠颜色表意）。等级阈值复用 metrics.usageLevel。
 */

import type { Node } from './types'
import type { UsageLevel } from './metrics'
import { toPercent, usageLevel } from './metrics'

/** 卡片呈现的状态（比 NodeStatusLevel 多一个 alert） */
export type NodeViewStatus = 'online' | 'offline' | 'alert' | 'unknown'

/** 状态文案（中文），与颜色一并发给卡片，满足「颜色 + 文字」双重区分 */
export const NODE_STATUS_LABELS: Record<NodeViewStatus, string> = {
  online: '在线',
  offline: '离线',
  alert: '告警',
  unknown: '未知',
}

/** 资源的三个使用率等级：CPU / 内存 / 硬盘 */
export function resourceLevels(node: Node): UsageLevel[] {
  return [
    usageLevel(node.cpu),
    usageLevel(toPercent(node.ram, node.ramTotal)),
    usageLevel(toPercent(node.disk, node.diskTotal)),
  ]
}

/** 取最严重的资源等级（ok < warn < crit） */
export function worstLevel(levels: readonly UsageLevel[]): UsageLevel {
  if (levels.includes('crit'))
    return 'crit'
  if (levels.includes('warn'))
    return 'warn'
  return 'ok'
}

/**
 * 节点视图状态：
 *  - 无状态数据 → unknown
 *  - 有状态但离线 → offline（离线优先于告警）
 *  - 在线且任一资源达 warn/crit → alert
 *  - 其它 → online
 */
export function nodeViewStatus(node: Node | null | undefined): NodeViewStatus {
  if (!node || !node.hasStatus)
    return 'unknown'
  if (!node.online)
    return 'offline'
  return worstLevel(resourceLevels(node)) === 'ok' ? 'online' : 'alert'
}

/** 状态 → 中文文案 */
export function nodeStatusLabel(status: NodeViewStatus): string {
  return NODE_STATUS_LABELS[status] ?? NODE_STATUS_LABELS.unknown
}
