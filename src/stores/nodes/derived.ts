/**
 * `useNodesStore` 的派生 getter 层：在线/总数计数、分组集合、UUID 索引。
 *
 * 只读派生，不含任何写入逻辑；全部接收 store 持有的 `nodes` ref 作为唯一数据源。
 */
import type { Ref } from 'vue'
import type { NodeData } from './types'
import { computed } from 'vue'
import { parseNodeGroups } from '@/utils/misc/groupHelper'

/** 创建节点列表的派生 getter */
export function createNodeSelectors(nodes: Ref<NodeData[]>) {
  /** 在线节点数量 */
  const onlineCount = computed(() => nodes.value.filter(n => n.online).length)

  /** 总节点数量 */
  const totalCount = computed(() => nodes.value.length)

  /** 所有分组 */
  const groups = computed(() => {
    const groupSet = new Set<string>()
    nodes.value.forEach((n) => {
      parseNodeGroups(n.group).forEach(group => groupSet.add(group))
    })
    return Array.from(groupSet)
  })

  /** 按 UUID 索引的节点映射 */
  const nodesByUuid = computed(() => {
    const map = new Map<string, NodeData>()
    nodes.value.forEach((n) => {
      map.set(n.uuid, n)
    })
    return map
  })

  return {
    onlineCount,
    totalCount,
    groups,
    nodesByUuid,
  }
}
