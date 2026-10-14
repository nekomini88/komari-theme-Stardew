import type { NodeData } from './nodes/types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createNodeCollection } from './nodes/collection'
import { createNodeSelectors } from './nodes/derived'
import { createWsState } from './nodes/ws'

export type { NodeData, TrafficLimitType, WsConnectionState } from './nodes/types'

/**
 * 节点 store（对外 API 与拆分前完全一致）。
 *
 * 内部按职责拆到 `./nodes/` 下的子模块，store 主体只负责组装：
 * - `nodes/types.ts`       节点领域类型（NodeData / StatusData / WsConnectionState / TrafficLimitType）
 * - `nodes/nodeFactory.ts` 纯函数：Client → NodeData、状态覆盖、状态提取
 * - `nodes/derived.ts`     只读派生：onlineCount / totalCount / groups / nodesByUuid
 * - `nodes/collection.ts`  集合变更：initNodes / updateNodeStatuses / updateNodeClients / sortNodesByWeight / clearNodes
 * - `nodes/ws.ts`          WebSocket 连接状态与 updateWsState
 */
const useNodesStore = defineStore('nodes', () => {
  // ===== 状态 =====
  const nodes = ref<NodeData[]>([])

  // ===== 计算属性 =====
  const { onlineCount, totalCount, groups, nodesByUuid } = createNodeSelectors(nodes)

  // ===== 方法 =====
  const { initNodes, updateNodeStatuses, updateNodeClients, sortNodesByWeight, clearNodes } = createNodeCollection(nodes)

  // ===== WebSocket 状态 =====
  const { wsConnectionState, wsReconnectAttempts, updateWsState } = createWsState()

  return {
    // 状态
    nodes,
    wsConnectionState,
    wsReconnectAttempts,
    // 计算属性
    onlineCount,
    totalCount,
    groups,
    nodesByUuid,
    // 方法
    initNodes,
    updateNodeStatuses,
    updateNodeClients,
    sortNodesByWeight,
    updateWsState,
    clearNodes,
  }
})

export { useNodesStore }
