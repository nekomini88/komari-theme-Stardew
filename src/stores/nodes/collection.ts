/**
 * `useNodesStore` 的节点集合变更层：全量初始化、实时指标更新、基本信息更新、排序、清空。
 *
 * 分支、跳过条件、排序比较器、删除顺序（倒序遍历 splice）都与拆分前逐条对齐；
 * 所有写入都作用于传入的 `nodes` ref，因此 store 实例之间互不共享状态。
 */
import type { Ref } from 'vue'
import type { NodeData } from './types'
import type { Client, NodeStatus } from '@/utils/api/rpc'
import { createNodeFromClient, extractStatusData, extractStatusDataFromNode, updateNodeStatus } from './nodeFactory'

/** 创建节点集合的读写方法 */
export function createNodeCollection(nodes: Ref<NodeData[]>) {
  /**
   * 排序节点：离线节点沉底，同状态内按 weight 升序
   */
  function sortNodesByWeight(): void {
    nodes.value.sort((a, b) => {
      // 离线节点排到最后
      if (a.online !== b.online)
        return a.online ? -1 : 1
      // 同状态按 weight 升序
      return a.weight - b.weight
    })
  }

  /**
   * 初始化节点数据（首次加载）
   */
  function initNodes(clients: Record<string, Client>, statuses: Record<string, NodeStatus>): void {
    const uuids = Object.keys(clients)
    const existingUuids = new Set(nodes.value.map(n => n.uuid))

    // 更新现有节点或添加新节点
    uuids.forEach((uuid) => {
      const client = clients[uuid]
      if (!client)
        return

      const status = statuses[uuid]
      const index = nodes.value.findIndex(n => n.uuid === uuid)

      if (existingUuids.has(uuid) && index !== -1) {
        // 更新现有节点
        const baseNode = createNodeFromClient(client)
        nodes.value[index] = status
          ? updateNodeStatus(baseNode, extractStatusData(status))
          : baseNode
      }
      else {
        // 添加新节点
        const newNode = createNodeFromClient(client)
        nodes.value.push(status
          ? updateNodeStatus(newNode, extractStatusData(status))
          : newNode,
        )
      }
    })

    // 移除不存在的节点
    const newUuids = new Set(uuids)
    for (let i = nodes.value.length - 1; i >= 0; i--) {
      const node = nodes.value[i]
      if (node && !newUuids.has(node.uuid)) {
        nodes.value.splice(i, 1)
      }
    }

    // 按 weight 降序排序（weight 越大越靠前）
    sortNodesByWeight()
  }

  /**
   * 更新节点状态（实时更新）
   */
  function updateNodeStatuses(statuses: Record<string, NodeStatus>): void {
    let onlineChanged = false
    Object.entries(statuses).forEach(([uuid, status]) => {
      const index = nodes.value.findIndex(n => n.uuid === uuid)
      if (index === -1)
        return

      const node = nodes.value[index]
      if (!node)
        return

      if (node.online !== status.online)
        onlineChanged = true

      nodes.value[index] = updateNodeStatus(node, extractStatusData(status))
    })
    // 节点上/下线时重新排序
    if (onlineChanged)
      sortNodesByWeight()
  }

  /**
   * 更新节点基本信息
   */
  function updateNodeClients(clients: Record<string, Client>): void {
    const newUuids = new Set(Object.keys(clients))

    // 更新现有节点信息或添加新节点
    Object.entries(clients).forEach(([uuid, client]) => {
      const index = nodes.value.findIndex(n => n.uuid === uuid)

      if (index !== -1) {
        // 更新现有节点，保留状态信息
        const currentNode = nodes.value[index]
        if (!currentNode)
          return

        const baseNode = createNodeFromClient(client)
        nodes.value[index] = updateNodeStatus(baseNode, extractStatusDataFromNode(currentNode))
      }
      else {
        // 添加新节点（不带状态）
        nodes.value.push(createNodeFromClient(client))
      }
    })

    // 移除不存在的节点
    for (let i = nodes.value.length - 1; i >= 0; i--) {
      const node = nodes.value[i]
      if (node && !newUuids.has(node.uuid)) {
        nodes.value.splice(i, 1)
      }
    }

    // 按 weight 降序排序
    sortNodesByWeight()
  }

  /**
   * 清空所有节点数据（不改动 WS 连接状态）
   */
  function clearNodes(): void {
    nodes.value = []
  }

  return {
    initNodes,
    updateNodeStatuses,
    updateNodeClients,
    sortNodesByWeight,
    clearNodes,
  }
}
