import type { NodeData, NodeStatus, StatusData, TrafficLimitType } from './types'
/**
 * `useNodesStore` 的节点构造与状态整形（纯函数，无状态）。
 *
 * 三个函数原先都是 store 内部的闭包函数，但都不依赖 store 状态，拆分后保持逐字段的
 * 同一套映射，任何字段的取舍与默认值都与拆分前一致。
 */
import type { Client } from '@/utils/api/rpc'

/**
 * 从 Client 对象创建节点数据（状态字段全部取默认值）
 */
export function createNodeFromClient(client: Client): NodeData {
  return {
    uuid: client.uuid,
    name: client.name,
    cpu_name: client.cpu_name,
    virtualization: client.virtualization,
    arch: client.arch,
    cpu_cores: client.cpu_cores,
    os: client.os,
    kernel_version: client.kernel_version,
    gpu_name: client.gpu_name,
    ipv4: client.ipv4,
    ipv6: client.ipv6,
    region: client.region,
    remark: client.remark,
    public_remark: client.public_remark,
    mem_total: client.mem_total,
    swap_total: client.swap_total,
    disk_total: client.disk_total,
    version: client.version,
    weight: client.weight,
    price: client.price,
    billing_cycle: client.billing_cycle,
    auto_renewal: client.auto_renewal,
    currency: client.currency,
    expired_at: client.expired_at,
    group: client.group,
    tags: client.tags,
    hidden: client.hidden,
    traffic_limit: client.traffic_limit,
    traffic_limit_type: client.traffic_limit_type as TrafficLimitType,
    created_at: client.created_at,
    updated_at: client.updated_at,
    // Status 默认值
    online: false,
    time: '',
    cpu: 0,
    gpu: 0,
    ram: 0,
    swap: 0,
    load: 0,
    load5: 0,
    load15: 0,
    temp: 0,
    disk: 0,
    net_in: 0,
    net_out: 0,
    net_total_up: 0,
    net_total_down: 0,
    process: 0,
    connections: 0,
    connections_udp: 0,
    uptime: 0,
  }
}

/**
 * 用状态数据覆盖节点的状态字段（基本信息原样保留）
 */
export function updateNodeStatus(node: NodeData, status: StatusData): NodeData {
  return {
    ...node,
    online: status.online,
    time: status.time,
    cpu: status.cpu,
    gpu: status.gpu,
    ram: status.ram,
    swap: status.swap,
    load: status.load,
    load5: status.load5,
    load15: status.load15,
    temp: status.temp,
    disk: status.disk,
    net_in: status.net_in,
    net_out: status.net_out,
    net_total_up: status.net_total_up,
    net_total_down: status.net_total_down,
    process: status.process,
    connections: status.connections,
    connections_udp: status.connections_udp,
    uptime: status.uptime,
  }
}

/**
 * 从 NodeStatus 提取状态数据
 */
export function extractStatusData(status: NodeStatus): StatusData {
  return {
    online: status.online,
    time: status.time,
    cpu: status.cpu,
    gpu: status.gpu,
    ram: status.ram,
    swap: status.swap,
    load: status.load,
    load5: status.load5,
    load15: status.load15,
    temp: status.temp,
    disk: status.disk,
    net_in: status.net_in,
    net_out: status.net_out,
    net_total_up: status.net_total_up,
    net_total_down: status.net_total_down,
    process: status.process,
    connections: status.connections,
    connections_udp: status.connections_udp,
    uptime: status.uptime,
  }
}

/**
 * 从已有节点反向提取状态数据（用于「只更新基本信息、保留状态指标」的路径）。
 * 映射字段与 `extractStatusData` 完全相同。
 */
export function extractStatusDataFromNode(node: NodeData): StatusData {
  return {
    online: node.online,
    time: node.time,
    cpu: node.cpu,
    gpu: node.gpu,
    ram: node.ram,
    swap: node.swap,
    load: node.load,
    load5: node.load5,
    load15: node.load15,
    temp: node.temp,
    disk: node.disk,
    net_in: node.net_in,
    net_out: node.net_out,
    net_total_up: node.net_total_up,
    net_total_down: node.net_total_down,
    process: node.process,
    connections: node.connections,
    connections_udp: node.connections_udp,
    uptime: node.uptime,
  }
}
