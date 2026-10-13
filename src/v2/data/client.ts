/**
 * Komari 数据面（v2）
 *
 * 端点：/api/rpc2 —— JSON-RPC 2.0 over HTTP POST。
 *
 * 说明：任务原文提到 /api/clients；实测该路径是 WebSocket 端点
 * （HTTP GET 返回 {"error":"Require WebSocket upgrade"}，无会话时升级被 403 拒绝），
 * 因此 HTTP 数据面统一走 /api/rpc2 的 common:* 方法。真实样本见
 * tests/fixtures/clients.sample.json。
 *
 * 所有函数接受可注入的 fetcher（默认 globalThis.fetch），便于单测/ e2e mock。
 */

import type { RawClient, RawStatus } from './types'

/** RPC 端点（相对路径，随部署根走） */
export const RPC_ENDPOINT = '/api/rpc2'

/** 供测试/展示的端点说明 */
export const CLIENTS_ENDPOINT_NOTE = '/api/clients 为 WebSocket 端点；HTTP 数据面走 /api/rpc2'

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

interface RpcSuccess<T> { jsonrpc: string, id: unknown, result: T }
interface RpcErrorBody { jsonrpc: string, id: unknown, error: { code: number, message: string } }

export class RpcError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.name = 'RpcError'
    this.code = code
  }
}

let rpcId = 0

/** 调用 /api/rpc2 的单个 JSON-RPC 方法（带超时） */
export async function rpcCall<T = unknown>(
  method: string,
  params: Record<string, unknown> | unknown[] = {},
  opts: { fetcher?: Fetcher, timeout?: number, endpoint?: string } = {},
): Promise<T> {
  const fetcher: Fetcher = opts.fetcher ?? globalThis.fetch
  const endpoint = opts.endpoint ?? RPC_ENDPOINT
  const timeout = opts.timeout ?? 15000
  const id = ++rpcId

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), timeout) : null

  let res: Response
  try {
    res = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id }),
      signal: controller?.signal,
    })
  }
  catch (e) {
    if (timer)
      clearTimeout(timer)
    throw new RpcError(-32000, `network error: ${e instanceof Error ? e.message : String(e)}`)
  }

  if (timer)
    clearTimeout(timer)

  if (!res.ok)
    throw new RpcError(res.status, `HTTP ${res.status}`)

  const body = await res.json() as RpcSuccess<T> | RpcErrorBody
  if (body && typeof body === 'object' && 'error' in body)
    throw new RpcError(body.error.code, body.error.message)
  return (body as RpcSuccess<T>).result
}

/** 客户端×状态合并载荷 */
export interface ClientsPayload {
  nodes: Record<string, RawClient>
  statuses: Record<string, RawStatus>
}

/** 拉取节点静态信息 + 最新状态（并行） */
export async function fetchClients(opts: { fetcher?: Fetcher, timeout?: number } = {}): Promise<ClientsPayload> {
  const [nodes, statuses] = await Promise.all([
    rpcCall<Record<string, RawClient>>('common:getNodes', {}, opts),
    rpcCall<Record<string, RawStatus>>('common:getNodesLatestStatus', {}, opts),
  ])
  return { nodes: nodes ?? {}, statuses: statuses ?? {} }
}

/** 拉取近 N 分钟采样 */
export async function fetchRecent(uuid: string, limit = 30, opts: { fetcher?: Fetcher } = {}): Promise<Record<string, unknown>[]> {
  const r = await rpcCall<{ records?: Record<string, unknown>[] }>('common:getNodeRecentStatus', { uuid, limit }, opts)
  return r?.records ?? []
}

/** 拉取 Ping 历史（近 hours 小时） */
export async function fetchPingRecords(uuid: string, hours = 1, opts: { fetcher?: Fetcher } = {}): Promise<Record<string, unknown>[]> {
  const r = await rpcCall<{ records?: Record<string, unknown>[] }>('common:getRecords', { type: 'ping', uuid, hours }, opts)
  return r?.records ?? []
}

/** 拉取负载历史（近 hours 小时） */
export async function fetchLoadRecords(uuid: string, hours = 1, opts: { fetcher?: Fetcher } = {}): Promise<Record<string, unknown>[]> {
  const r = await rpcCall<{ records?: Record<string, unknown>[] }>('common:getRecords', { type: 'load', uuid, hours }, opts)
  const records = r?.records
  if (Array.isArray(records))
    return records
  // getRecords(type=load) 的 records 是 { uuid: [...] } 形状时取该节点的数组
  if (records && typeof records === 'object')
    return (records as Record<string, Record<string, unknown>[]>)[uuid] ?? []
  return []
}
