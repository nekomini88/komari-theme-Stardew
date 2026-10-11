import type { Fetcher } from '@/v2/data/client'
import type { RawClient, RawStatus } from '@/v2/data/types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { fetchClients, fetchLoadRecords, fetchPingRecords, fetchRecent, rpcCall, RpcError } from '@/v2/data/client'
import { useClients } from '@/v2/data/useClients'

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'fixtures', 'clients.sample.json'), 'utf8'),
) as { nodes: Record<string, RawClient>, statuses: Record<string, RawStatus> }

/** 构造一个按 JSON-RPC method 分派的 mock fetcher */
function mockFetcher(handler: (method: string, params: Record<string, unknown>) => unknown): Fetcher {
  return async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { id: unknown, method: string, params: Record<string, unknown> }
    try {
      const result = handler(body.method, body.params ?? {})
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), { status: 200 })
    }
    catch (e) {
      const err = e as RpcError
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: err.code ?? -1, message: err.message } }), { status: 200 })
    }
  }
}

describe('rpcCall / fetchClients（注入 fetcher）', () => {
  it('fetchClients 并行拉取 nodes + statuses，形状正确', async () => {
    const fetcher = mockFetcher((method) => {
      if (method === 'common:getNodes')
        return fixture.nodes
      if (method === 'common:getNodesLatestStatus')
        return fixture.statuses
      throw new RpcError(-32601, 'method not found')
    })
    const payload = await fetchClients({ fetcher })
    expect(Object.keys(payload.nodes).length).toBe(Object.keys(fixture.nodes).length)
    expect(Object.keys(payload.statuses).length).toBe(Object.keys(fixture.statuses).length)
  })

  it('RPC error 响应 → 抛 RpcError', async () => {
    const fetcher = mockFetcher(() => {
      throw new RpcError(-32601, 'method not found')
    })
    await expect(rpcCall('nope', {}, { fetcher })).rejects.toBeInstanceOf(RpcError)
  })

  it('HTTP 非 2xx → RpcError(HTTP)', async () => {
    const fetcher: Fetcher = async () => new Response('nope', { status: 500 })
    await expect(rpcCall('x', {}, { fetcher })).rejects.toMatchObject({ name: 'RpcError' })
  })

  it('fetchRecent / fetchPingRecords / fetchLoadRecords 解析 records', async () => {
    const fetcher = mockFetcher((method, params) => {
      if (method === 'common:getNodeRecentStatus')
        return { count: 1, records: [{ time: 't', cpu: 1 }] }
      if (method === 'common:getRecords' && params.type === 'ping')
        return { count: 2, records: [{ task_id: 1, value: 10, time: 't' }] }
      if (method === 'common:getRecords' && params.type === 'load')
        return { count: 1, records: { 'uuid-x': [{ time: 't', cpu: 1 }] } }
      return {}
    })
    expect(await fetchRecent('u', 10, { fetcher })).toHaveLength(1)
    expect(await fetchPingRecords('u', 1, { fetcher })).toHaveLength(1)
    expect(await fetchLoadRecords('uuid-x', 1, { fetcher })).toHaveLength(1)
  })

  it('fetchLoadRecords 兼容数组形状', async () => {
    const fetcher = mockFetcher(() => ({ records: [{ time: 't' }] }))
    expect(await fetchLoadRecords('u', 1, { fetcher })).toHaveLength(1)
  })
})

describe('useClients：加载态 / 成功 / 失败重试', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('首次加载置 loading=true，成功后 nodes 来自真实样本', async () => {
    const fetcher = mockFetcher(method => method === 'common:getNodes' ? fixture.nodes : fixture.statuses)
    const c = useClients({ fetcher, intervalMs: 5000, autoLifecycle: false })
    expect(c.loading.value).toBe(false)
    const p = c.load(true)
    expect(c.loading.value).toBe(true)
    await p
    expect(c.loading.value).toBe(false)
    expect(c.error.value).toBeNull()
    expect(c.nodes.value).toHaveLength(Object.keys(fixture.nodes).length)
    expect(c.lastUpdated.value).not.toBeNull()
    c.stop()
  })

  it('失败：保留数据、置 error、按退避重试后恢复', async () => {
    let call = 0
    const fetcher = mockFetcher((method) => {
      call++
      if (call <= 2)
        throw new RpcError(-32000, 'boom')
      return method === 'common:getNodes' ? fixture.nodes : fixture.statuses
    })
    const c = useClients({ fetcher, intervalMs: 1000, autoLifecycle: false })
    // 必须 start():useClients 只在轮询处于运行态(stopped=false)时才排退避重试定时器,
    // 否则 schedule() 直接 return,推进时间也不会有重试。
    c.start()
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()
    expect(c.error.value).toContain('boom')
    expect(c.failures.value).toBeGreaterThanOrEqual(1)
    // 让退避定时器依次触发重试，直到恢复
    for (let i = 0; i < 6 && c.error.value; i++) {
      await vi.advanceTimersByTimeAsync(4000)
      await nextTick()
    }
    expect(c.error.value).toBeNull()
    expect(c.nodes.value.length).toBeGreaterThan(0)
    c.stop()
  })

  it('retry() 清空 error 并立即重试', async () => {
    let fail = true
    const fetcher = mockFetcher((method) => {
      if (fail)
        throw new RpcError(-32000, 'down')
      return method === 'common:getNodes' ? fixture.nodes : fixture.statuses
    })
    const c = useClients({ fetcher, intervalMs: 0, autoLifecycle: false })
    await c.load(true)
    expect(c.error.value).toContain('down')
    fail = false
    await c.retry()
    expect(c.error.value).toBeNull()
    expect(c.nodes.value.length).toBeGreaterThan(0)
    c.stop()
  })

  it('start/stop 控制轮询：intervalMs>0 时定时刷新，stop 后不再请求', async () => {
    let calls = 0
    const fetcher = mockFetcher((method) => {
      calls++
      return method === 'common:getNodes' ? fixture.nodes : fixture.statuses
    })
    const c = useClients({ fetcher, intervalMs: 1000, autoLifecycle: false })
    c.start()
    await vi.advanceTimersByTimeAsync(0)
    const afterFirst = calls
    expect(afterFirst).toBe(2) // nodes + statuses
    await vi.advanceTimersByTimeAsync(3200)
    expect(calls).toBeGreaterThan(afterFirst)
    c.stop()
    const atStop = calls
    await vi.advanceTimersByTimeAsync(5000)
    expect(calls).toBe(atStop)
  })
})
