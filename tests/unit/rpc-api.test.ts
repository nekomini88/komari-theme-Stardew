/**
 * 行为钉死测试：src/utils/api/rpc.ts 与 src/utils/api/api.ts
 *
 * 目的：重构（按职责拆分这两个文件）前，把**对外可观察行为**固定下来 ——
 * 请求 URL / 方法 / 请求体形状、错误路径与错误文案、超时/中断、WS 重连与降级。
 *
 * 全部使用 mock：vi.stubGlobal('fetch', ...) 与手写假 Response / 假 WebSocket。
 * 本文件不发起任何真实网络请求，也不依赖任何服务器。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  KomariRpc,
  resetSharedRpc,
  getSharedRpc,
  RpcClient,
  RpcError,
} from '@/utils/api/rpc'
import {
  ApiError,
  KomariApi,
  RealtimeWebSocket,
  getSharedApi,
  resetSharedApi,
} from '@/utils/api/api'

// ==================== 假响应 ====================

interface FakeResponseInit {
  status?: number
  ok?: boolean
  body?: unknown
  headers?: Record<string, string>
  jsonImpl?: () => Promise<unknown>
}

function fakeResponse(init: FakeResponseInit = {}) {
  const status = init.status ?? 200
  const loweredHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(init.headers ?? {}))
    loweredHeaders[k.toLowerCase()] = v
  return {
    ok: init.ok ?? (status >= 200 && status < 300),
    status,
    headers: {
      get: (name: string) => loweredHeaders[name.toLowerCase()] ?? null,
    },
    json: init.jsonImpl ?? (async () => init.body),
  }
}

// ==================== 假 WebSocket ====================

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: MockWebSocket[] = []

  url: string
  readyState = MockWebSocket.CONNECTING
  sent: string[] = []
  onopen: ((ev?: unknown) => void) | null = null
  onerror: ((ev?: unknown) => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: ((ev?: unknown) => void) | null = null

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  // ---- 测试驱动辅助 ----
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  simulateMessage(payload: unknown): void {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
    this.onmessage?.({ data })
  }

  simulateError(): void {
    this.onerror?.({ type: 'error' })
  }

  last(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1]
  }
}

function lastWs(): MockWebSocket {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1]
}

/** 冲刷微任务与 0ms 定时器：等待 WS 传输里多级 await 完成后再断言 */
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  MockWebSocket.instances = []
  vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  resetSharedRpc()
  resetSharedApi()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  resetSharedRpc()
  resetSharedApi()
})

// ============================================================
// rpc.ts
// ============================================================

describe('rpc.ts — RpcError', () => {
  it('形状：name/code/message/data，是 Error 实例', () => {
    const err = new RpcError(-32601, 'Method not found', { hint: 'x' })
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(RpcError)
    expect(err.name).toBe('RpcError')
    expect(err.code).toBe(-32601)
    expect(err.message).toBe('Method not found')
    expect(err.data).toEqual({ hint: 'x' })
  })

  it('data 缺省为 undefined', () => {
    const err = new RpcError(1, 'boom')
    expect(err.data).toBeUndefined()
  })
})

describe('rpc.ts — RpcClient.callHttp：请求形状', () => {
  it('默认 baseUrl 为 `${VITE_API_BASE}/rpc2`，默认 POST 到该地址', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ body: { jsonrpc: '2.0', id: 1, result: { ok: true } } }))
    const client = new RpcClient()
    await client.call('rpc.ping')
    const expectedBase = `${import.meta.env.VITE_API_BASE || ''}/rpc2`
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(expectedBase)
  })

  it('method=POST、Content-Type: application/json、带 AbortSignal', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ body: { jsonrpc: '2.0', id: 1, result: 1 } }))
    const client = new RpcClient({ baseUrl: 'https://example.test/rpc2' })
    await client.call('rpc.ping')
    const init = fetchMock.mock.calls[0][1]
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('请求体形状：JSON-RPC 2.0 的 jsonrpc/id/method/params 四字段', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ body: { jsonrpc: '2.0', id: 1, result: 1 } }))
    const client = new RpcClient({ baseUrl: '/rpc2' })
    await client.call('common:getRecords', { type: 'ping', task_id: 3 })
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent).toEqual({
      jsonrpc: '2.0',
      method: 'common:getRecords',
      params: { type: 'ping', task_id: 3 },
      id: 1,
    })
  })

  it('params 省略时被 JSON 丢弃（线上无 params 键），id 从 1 起自增', async () => {
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ body: { jsonrpc: '2.0', id: 1, result: 'a' } }))
      .mockResolvedValueOnce(fakeResponse({ body: { jsonrpc: '2.0', id: 2, result: 'b' } }))
    const client = new RpcClient({ baseUrl: '/rpc2' })
    await client.call('m1')
    await client.call('m2', [1, 2])
    const first = JSON.parse(fetchMock.mock.calls[0][1].body)
    const second = JSON.parse(fetchMock.mock.calls[1][1].body)
    // JSON.stringify 会丢弃值为 undefined 的属性：无 params 时线上不出现该键
    expect('params' in first).toBe(false)
    expect(first.id).toBe(1)
    expect(second.params).toEqual([1, 2])
    expect(second.id).toBe(2)
  })

  it('成功响应返回 result（不校验 jsonrpc/id 字段）', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ body: { jsonrpc: '2.0', id: 99, result: { v: 7 } } }))
    const client = new RpcClient({ baseUrl: '/rpc2' })
    await expect(client.call('x')).resolves.toEqual({ v: 7 })
  })
})

describe('rpc.ts — RpcClient.callHttp：错误路径', () => {
  it('非 2xx → RpcError(code=HTTP status, `HTTP error: <status>`)', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ status: 500, ok: false }))
    const client = new RpcClient({ baseUrl: '/rpc2' })
    const err = await client.call('x').catch(e => e)
    expect(err).toBeInstanceOf(RpcError)
    expect(err.code).toBe(500)
    expect(err.message).toBe('HTTP error: 500')
  })

  it('404 同样按 `HTTP error: 404` 抛出', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ status: 404, ok: false }))
    const client = new RpcClient({ baseUrl: '/rpc2' })
    await expect(client.call('x')).rejects.toMatchObject({ code: 404, message: 'HTTP error: 404' })
  })

  it('JSON 解析失败 → RpcError(-32000, `Network error: ...`)', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({
      jsonImpl: async () => {
        throw new SyntaxError('Unexpected token < in JSON')
      },
    }))
    const client = new RpcClient({ baseUrl: '/rpc2' })
    const err = await client.call('x').catch(e => e)
    expect(err).toBeInstanceOf(RpcError)
    expect(err.code).toBe(-32000)
    expect(err.message).toBe('Network error: Unexpected token < in JSON')
  })

  it('payload.error → RpcError(code/message/data 原样透传)', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({
      body: { jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found', data: { m: 'x' } } },
    }))
    const client = new RpcClient({ baseUrl: '/rpc2' })
    const err = await client.call('x').catch(e => e)
    expect(err).toBeInstanceOf(RpcError)
    expect(err.code).toBe(-32601)
    expect(err.message).toBe('Method not found')
    expect(err.data).toEqual({ m: 'x' })
  })

  it('HTTP 非 2xx 优先于 payload.error（不会解析 body）', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ status: 503, ok: false, body: { error: { code: 1, message: 'x' } } }))
    const client = new RpcClient({ baseUrl: '/rpc2' })
    await expect(client.call('x')).rejects.toMatchObject({ code: 503, message: 'HTTP error: 503' })
  })

  it('fetch 直接 reject → RpcError(-32000, `Network error: <msg>`)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const client = new RpcClient({ baseUrl: '/rpc2' })
    const err = await client.call('x').catch(e => e)
    expect(err.code).toBe(-32000)
    expect(err.message).toBe('Network error: Failed to fetch')
  })

  it('fetch reject 非 Error 值时用 String() 兜底', async () => {
    fetchMock.mockRejectedValueOnce('plain-string-failure')
    const client = new RpcClient({ baseUrl: '/rpc2' })
    await expect(client.call('x')).rejects.toMatchObject({ message: 'Network error: plain-string-failure' })
  })

  it('超时：到达 timeout 后 abort → Network error 抛出', async () => {
    vi.useFakeTimers()
    let aborted = false
    fetchMock.mockImplementationOnce((_url: string, init: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          aborted = true
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })
    const client = new RpcClient({ baseUrl: '/rpc2', timeout: 1000 })
    const p = client.call('x')
    const assertion = expect(p).rejects.toMatchObject({
      code: -32000,
      message: 'Network error: AbortError: The operation was aborted.',
    })
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
    expect(aborted).toBe(true)
  })

  it('未到超时前不 abort（请求正常完成）', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValueOnce(fakeResponse({ body: { jsonrpc: '2.0', id: 1, result: 'ok' } }))
    const client = new RpcClient({ baseUrl: '/rpc2', timeout: 5000 })
    const p = client.call('x')
    await vi.advanceTimersByTimeAsync(100)
    await expect(p).resolves.toBe('ok')
  })
})

describe('rpc.ts — RpcClient.setTransport / 关闭', () => {
  it('setTransport(true) 让 call 走 WebSocket（fetch 不被调用）', async () => {
    const client = new RpcClient({ baseUrl: 'ws://example.test/rpc2' })
    client.setTransport(true)
    const p = client.call('rpc.ping')
    const ws = lastWs()
    ws.simulateOpen()
    await flush()
    ws.simulateMessage({ jsonrpc: '2.0', id: 1, result: 'pong' })
    await expect(p).resolves.toBe('pong')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('setTransport(false) 会关闭现存 WebSocket', async () => {
    const client = new RpcClient({ baseUrl: 'ws://example.test/rpc2' })
    client.setTransport(true)
    const p = client.ensureWebSocketConnected()
    const ws = lastWs()
    ws.simulateOpen()
    await p
    expect(ws.readyState).toBe(MockWebSocket.OPEN)
    client.setTransport(false)
    expect(ws.readyState).toBe(MockWebSocket.CLOSED)
  })

  it('getWsReadyState/getWebSocket 反映连接状态', async () => {
    const client = new RpcClient({ baseUrl: 'ws://example.test/rpc2' })
    expect(client.getWebSocket()).toBeNull()
    expect(client.getWsReadyState()).toBe(MockWebSocket.CLOSED)
    client.setTransport(true)
    const p = client.ensureWebSocketConnected()
    lastWs().simulateOpen()
    await p
    expect(client.getWebSocket()).not.toBeNull()
    expect(client.getWsReadyState()).toBe(MockWebSocket.OPEN)
  })

  it('close() 关闭并清空 WebSocket', async () => {
    const client = new RpcClient({ baseUrl: 'ws://example.test/rpc2' })
    client.setTransport(true)
    const p = client.ensureWebSocketConnected()
    const ws = lastWs()
    ws.simulateOpen()
    await p
    client.close()
    expect(ws.readyState).toBe(MockWebSocket.CLOSED)
    expect(client.getWebSocket()).toBeNull()
  })
})

describe('rpc.ts — WebSocket 传输', () => {
  it('initWebSocket：https→wss、http→ws 协议替换', async () => {
    const c1 = new RpcClient({ baseUrl: 'https://host.test/rpc2' })
    c1.setTransport(true)
    const p1 = c1.ensureWebSocketConnected()
    expect(lastWs().url).toBe('wss://host.test/rpc2')
    lastWs().simulateOpen()
    await p1

    const c2 = new RpcClient({ baseUrl: 'http://host.test/rpc2' })
    c2.setTransport(true)
    const p2 = c2.ensureWebSocketConnected()
    expect(lastWs().url).toBe('ws://host.test/rpc2')
    lastWs().simulateOpen()
    await p2
  })

  it('WebSocket 就绪后 call 发送 JSON-RPC 请求体', async () => {
    const client = new RpcClient({ baseUrl: 'ws://host.test/rpc2' })
    client.setTransport(true)
    const p = client.call('common:getNodes', { a: 1 })
    const ws = lastWs()
    ws.simulateOpen()
    await flush()
    expect(JSON.parse(ws.sent.at(-1)!)).toEqual({
      jsonrpc: '2.0',
      method: 'common:getNodes',
      params: { a: 1 },
      id: 1,
    })
    ws.simulateMessage({ jsonrpc: '2.0', id: 1, result: {} })
    await expect(p).resolves.toEqual({})
  })

  it('WS 收到 error 响应 → 该请求以 RpcError 拒绝', async () => {
    const client = new RpcClient({ baseUrl: 'ws://host.test/rpc2' })
    client.setTransport(true)
    const p = client.call('x')
    const ws = lastWs()
    ws.simulateOpen()
    await flush()
    ws.simulateMessage({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'ws err' } })
    await expect(p).rejects.toMatchObject({ code: -32000, message: 'ws err' })
  })

  it('id === null 的消息被忽略（不 resolve/reject）', async () => {
    const client = new RpcClient({ baseUrl: 'ws://host.test/rpc2' })
    client.setTransport(true)
    const p = client.call('x')
    const ws = lastWs()
    ws.simulateOpen()
    await flush()
    ws.simulateMessage({ jsonrpc: '2.0', id: null, result: 'ignored' })
    // 随后用正确 id 完成
    ws.simulateMessage({ jsonrpc: '2.0', id: 1, result: 'real' })
    await expect(p).resolves.toBe('real')
  })

  it('WS 收到非法 JSON 被吞掉（不崩溃）', async () => {
    const client = new RpcClient({ baseUrl: 'ws://host.test/rpc2' })
    client.setTransport(true)
    const p = client.call('x')
    const ws = lastWs()
    ws.simulateOpen()
    await flush()
    expect(() => ws.simulateMessage('not-json{')).not.toThrow()
    ws.simulateMessage({ jsonrpc: '2.0', id: 1, result: 'recovered' })
    await expect(p).resolves.toBe('recovered')
  })

  it('连接错误（onerror）→ 未打开的请求以 RpcError(-32000) 拒绝', async () => {
    const client = new RpcClient({ baseUrl: 'ws://host.test/rpc2' })
    client.setTransport(true)
    const p = client.ensureWebSocketConnected()
    lastWs().simulateError()
    await expect(p).rejects.toMatchObject({ code: -32000, message: 'WebSocket connection error' })
  })

  it('onclose 时所有 pending 请求以 `WebSocket closed` 拒绝', async () => {
    const client = new RpcClient({ baseUrl: 'ws://host.test/rpc2' })
    client.setTransport(true)
    const p = client.call('x')
    const ws = lastWs()
    ws.simulateOpen()
    await flush()
    ws.close()
    await expect(p).rejects.toMatchObject({ code: -32000, message: 'WebSocket closed' })
  })

  it('WS 请求超时 → RpcError(-32001, Request timeout)', async () => {
    vi.useFakeTimers()
    const client = new RpcClient({ baseUrl: 'ws://host.test/rpc2', timeout: 2000 })
    client.setTransport(true)
    const p = client.call('x')
    const ws = lastWs()
    ws.simulateOpen()
    await vi.advanceTimersByTimeAsync(0)
    const assertion = expect(p).rejects.toMatchObject({ code: -32001, message: 'Request timeout' })
    await vi.advanceTimersByTimeAsync(2000)
    await assertion
  })

  it('ensureWebSocketReady：并发调用只建一个连接（复用进行中的连接 Promise）', async () => {
    const client = new RpcClient({ baseUrl: 'ws://host.test/rpc2' })
    client.setTransport(true)
    const p1 = client.ensureWebSocketConnected()
    const p2 = client.ensureWebSocketConnected()
    expect(MockWebSocket.instances.length).toBe(1)
    lastWs().simulateOpen()
    await Promise.all([p1, p2])
  })

  it('重连时替换残留的旧连接（initWebSocket 先关闭未就绪的 this.ws）', async () => {
    const client = new RpcClient({ baseUrl: 'ws://host.test/rpc2' })
    client.setTransport(true)
    const p = client.ensureWebSocketConnected()
    const first = lastWs()
    first.simulateError() // 出错但 this.ws 仍被保留
    await expect(p).rejects.toBeInstanceOf(RpcError)
    const retry = client.ensureWebSocketConnected()
    // 新连接被创建
    expect(MockWebSocket.instances.length).toBe(2)
    expect(lastWs()).not.toBe(first)
    expect(first.readyState).toBe(MockWebSocket.CLOSED)
    lastWs().simulateOpen()
    await retry
  })

  it('降级分支：连接在发送前断开 → 请求以 `WebSocket not connected` 拒绝', async () => {
    const client = new RpcClient({ baseUrl: 'ws://host.test/rpc2' })
    client.setTransport(true)
    const p = client.call('x')
    const ws = lastWs()
    ws.simulateOpen() // 让 ensureWebSocketReady 的 Promise resolve
    ws.close() // 但紧接着断开（同步），续行时 this.ws 已为 null
    await expect(p).rejects.toMatchObject({ code: -32000, message: 'WebSocket not connected' })
  })

  it('ensureWebSocketConnectedWithPing：ping 返回 error 时向上抛出', async () => {
    const client = new RpcClient({ baseUrl: 'ws://host.test/rpc2' })
    client.setTransport(true)
    const p = client.ensureWebSocketConnectedWithPing()
    const ws = lastWs()
    ws.simulateOpen()
    await flush()
    const sent = JSON.parse(ws.sent.at(-1)!)
    ws.simulateMessage({ jsonrpc: '2.0', id: sent.id, error: { code: -32601, message: 'no ping' } })
    await expect(p).rejects.toMatchObject({ code: -32601, message: 'no ping' })
  })

  it('ensureWebSocketConnectedWithPing 发送 rpc.ping 并等待结果', async () => {
    const client = new RpcClient({ baseUrl: 'ws://host.test/rpc2' })
    client.setTransport(true)
    const p = client.ensureWebSocketConnectedWithPing()
    const ws = lastWs()
    ws.simulateOpen()
    await flush()
    const sent = JSON.parse(ws.sent.at(-1)!)
    expect(sent.method).toBe('rpc.ping')
    ws.simulateMessage({ jsonrpc: '2.0', id: sent.id, result: 'pong' })
    await expect(p).resolves.toBeUndefined()
  })
})

describe('rpc.ts — KomariRpc 方法映射', () => {
  function makeRpc() {
    const rpc = new KomariRpc({ baseUrl: '/rpc2' })
    const spy = vi.spyOn(rpc.getClient(), 'call').mockResolvedValue('R' as never)
    return { rpc, spy }
  }

  it('getMethods → rpc.getMethods', async () => {
    const { rpc, spy } = makeRpc()
    await rpc.getMethods()
    expect(spy).toHaveBeenCalledWith('rpc.getMethods')
  })

  it('getHelp → rpc.getHelp', async () => {
    const { rpc, spy } = makeRpc()
    await rpc.getHelp()
    expect(spy).toHaveBeenCalledWith('rpc.getHelp')
  })

  it('ping → rpc.ping', async () => {
    const { rpc, spy } = makeRpc()
    await rpc.ping()
    expect(spy).toHaveBeenCalledWith('rpc.ping')
  })

  it('getVersion → rpc.getVersion', async () => {
    const { rpc, spy } = makeRpc()
    await rpc.getVersion()
    expect(spy).toHaveBeenCalledWith('rpc.getVersion')
  })

  it('getNodes → common:getNodes', async () => {
    const { rpc, spy } = makeRpc()
    await rpc.getNodes()
    expect(spy).toHaveBeenCalledWith('common:getNodes')
  })

  it('getNodesLatestStatus → common:getNodesLatestStatus', async () => {
    const { rpc, spy } = makeRpc()
    await rpc.getNodesLatestStatus()
    expect(spy).toHaveBeenCalledWith('common:getNodesLatestStatus')
  })

  it('getNodeRecentStatus → common:getNodeRecentStatus { uuid, limit }', async () => {
    const { rpc, spy } = makeRpc()
    await rpc.getNodeRecentStatus('uuid-1', 50)
    expect(spy).toHaveBeenCalledWith('common:getNodeRecentStatus', { uuid: 'uuid-1', limit: 50 })
  })

  it('getPublicInfo → common:getPublicInfo', async () => {
    const { rpc, spy } = makeRpc()
    await rpc.getPublicInfo()
    expect(spy).toHaveBeenCalledWith('common:getPublicInfo')
  })

  it('getBackendVersion → common:getBackendVersion', async () => {
    const { rpc, spy } = makeRpc()
    await rpc.getBackendVersion()
    expect(spy).toHaveBeenCalledWith('common:getBackendVersion')
  })

  it('getRecords → common:getRecords 原样透传 params', async () => {
    const { rpc, spy } = makeRpc()
    await rpc.getRecords({ type: 'load', uuid: 'u', hours: 24 })
    expect(spy).toHaveBeenCalledWith('common:getRecords', { type: 'load', uuid: 'u', hours: 24 })
  })

  it('getLoadRecords → type:load + 参数名 load_type/max_count', async () => {
    const { rpc, spy } = makeRpc()
    await rpc.getLoadRecords('u', 12, 'cpu', 100)
    expect(spy).toHaveBeenCalledWith('common:getRecords', {
      type: 'load',
      uuid: 'u',
      hours: 12,
      load_type: 'cpu',
      max_count: 100,
    })
  })

  it('getPingRecords → type:ping + task_id/hours/max_count', async () => {
    const { rpc, spy } = makeRpc()
    await rpc.getPingRecords(7, 6, 30)
    expect(spy).toHaveBeenCalledWith('common:getRecords', {
      type: 'ping',
      task_id: 7,
      hours: 6,
      max_count: 30,
    })
  })

  it('getClient 返回底层 RpcClient', () => {
    const rpc = new KomariRpc({ baseUrl: '/rpc2' })
    expect(rpc.getClient()).toBeInstanceOf(RpcClient)
  })

  it('close 委派给底层 client.close', () => {
    const rpc = new KomariRpc({ baseUrl: '/rpc2' })
    const spy = vi.spyOn(rpc.getClient(), 'close').mockImplementation(() => {})
    rpc.close()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('rpc.ts — 单例', () => {
  it('getSharedRpc 返回同一实例', () => {
    const a = getSharedRpc()
    const b = getSharedRpc()
    expect(a).toBe(b)
    expect(a).toBeInstanceOf(KomariRpc)
  })

  it('resetSharedRpc 后拿到新实例且关闭旧实例', () => {
    const a = getSharedRpc()
    const closeSpy = vi.spyOn(a.getClient(), 'close').mockImplementation(() => {})
    resetSharedRpc()
    expect(closeSpy).toHaveBeenCalledTimes(1)
    const b = getSharedRpc()
    expect(b).not.toBe(a)
  })

  it('resetSharedRpc 在无实例时安全（不抛）', () => {
    resetSharedRpc()
    expect(() => resetSharedRpc()).not.toThrow()
  })
})

// ============================================================
// api.ts
// ============================================================

describe('api.ts — ApiError', () => {
  it('形状：name/status/code，默认 status=error', () => {
    const err = new ApiError('boom')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('ApiError')
    expect(err.message).toBe('boom')
    expect(err.status).toBe('error')
    expect(err.code).toBeUndefined()
  })

  it('可带自定义 status 与 code', () => {
    const err = new ApiError('nope', 'error', 403)
    expect(err.status).toBe('error')
    expect(err.code).toBe(403)
  })
})

describe('api.ts — KomariApi GET（get）', () => {
  it('默认 baseUrl 为 `${VITE_API_BASE || "/api"}`', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ body: { status: 'success', message: '', data: 1 } }))
    const api = new KomariApi()
    await api.getPublicSettings()
    const expected = `${import.meta.env.VITE_API_BASE || '/api'}/public`
    expect(fetchMock.mock.calls[0][0]).toBe(expected)
  })

  it('GET /public：方法 GET、credentials: include、带 signal', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ body: { status: 'success', message: '', data: { sitename: 'A' } } }))
    const api = new KomariApi({ baseUrl: '/api' })
    const data = await api.getPublicSettings()
    expect(data).toEqual({ sitename: 'A' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/public')
    expect(init.method).toBe('GET')
    expect(init.credentials).toBe('include')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('带 params 的 GET 拼接 query（跳过 undefined/null）', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ body: { status: 'success', message: '', data: {} } }))
    const api = new KomariApi({ baseUrl: '/api' })
    await api.getLoadRecords('uuid-9', 24)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/records/load?uuid=uuid-9&hours=24')
  })

  it('无 params 时不追加 `?`', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ body: { status: 'success', message: '', data: {} } }))
    const api = new KomariApi({ baseUrl: '/api' })
    await api.getVersion()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/version')
  })

  it('getPingRecords → /api/records/ping?uuid&hours', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ body: { status: 'success', message: '', data: { count: 0, records: [], tasks: [] } } }))
    const api = new KomariApi({ baseUrl: '/api' })
    await api.getPingRecords('u1', 6)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/records/ping?uuid=u1&hours=6')
  })

  it('getNodes → /api/nodes，getNodeRecentStatus → /api/recent/<uuid>', async () => {
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ body: { status: 'success', message: '', data: [] } }))
      .mockResolvedValueOnce(fakeResponse({ body: { status: 'success', message: '', data: [] } }))
    const api = new KomariApi({ baseUrl: '/api' })
    await api.getNodes()
    await api.getNodeRecentStatus('abc')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/nodes')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/recent/abc')
  })

  it('status === "error" → ApiError(message, "error", HTTP status)', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({
      status: 400,
      ok: false,
      body: { status: 'error', message: 'bad request', data: null },
    }))
    const api = new KomariApi({ baseUrl: '/api' })
    const err = await api.getPublicSettings().catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.message).toBe('bad request')
    expect(err.status).toBe('error')
    expect(err.code).toBe(400)
  })

  it('status === "error" 但 message 为空 → 回退 `Unknown error`', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ body: { status: 'error', message: '', data: null } }))
    const api = new KomariApi({ baseUrl: '/api' })
    await expect(api.getPublicSettings()).rejects.toMatchObject({ message: 'Unknown error' })
  })

  it('JSON 解析失败 → ApiError(`Network error: ...`, "error")', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({
      jsonImpl: async () => {
        throw new SyntaxError('Unexpected end of JSON input')
      },
    }))
    const api = new KomariApi({ baseUrl: '/api' })
    const err = await api.getPublicSettings().catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.message).toBe('Network error: Unexpected end of JSON input')
    expect(err.status).toBe('error')
  })

  it('fetch reject → ApiError(`Network error: <msg>`)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const api = new KomariApi({ baseUrl: '/api' })
    await expect(api.getPublicSettings()).rejects.toMatchObject({ message: 'Network error: Failed to fetch' })
  })

  it('fetch reject 非 Error 值 → String() 兜底', async () => {
    fetchMock.mockRejectedValueOnce(42)
    const api = new KomariApi({ baseUrl: '/api' })
    await expect(api.getPublicSettings()).rejects.toMatchObject({ message: 'Network error: 42' })
  })

  it('超时：timeout 后 abort → Network error', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementationOnce((_url: string, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
      }))
    const api = new KomariApi({ baseUrl: '/api', timeout: 500 })
    const p = api.getPublicSettings()
    const assertion = expect(p).rejects.toMatchObject({
      message: 'Network error: AbortError: The operation was aborted.',
    })
    await vi.advanceTimersByTimeAsync(500)
    await assertion
  })

  it('⚠️ 行为记录：get() 不检查 response.ok —— 非 2xx 但 body 为 success 时仍返回 data', async () => {
    // 这是当前实现的实际行为（与 getRaw/post 不同），重构时请勿无声改变。
    fetchMock.mockResolvedValueOnce(fakeResponse({
      status: 500,
      ok: false,
      body: { status: 'success', message: '', data: { leaked: true } },
    }))
    const api = new KomariApi({ baseUrl: '/api' })
    await expect(api.getPublicSettings()).resolves.toEqual({ leaked: true })
  })
})

describe('api.ts — KomariApi getRaw（getMe）', () => {
  it('getMe → GET /api/me，直接返回 body（非 ApiResponse 包装）', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ body: { logged_in: true, username: 'neo' } }))
    const api = new KomariApi({ baseUrl: '/api' })
    await expect(api.getMe()).resolves.toEqual({ logged_in: true, username: 'neo' })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/me')
    expect(fetchMock.mock.calls[0][1].method).toBe('GET')
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
  })

  it('getRaw 非 2xx → ApiError(`HTTP error: <status>`, "error", status)', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ status: 401, ok: false }))
    const api = new KomariApi({ baseUrl: '/api' })
    const err = await api.getMe().catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.message).toBe('HTTP error: 401')
    expect(err.code).toBe(401)
  })

  it('getRaw JSON 解析失败 → Network error', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({
      jsonImpl: async () => {
        throw new SyntaxError('bad json')
      },
    }))
    const api = new KomariApi({ baseUrl: '/api' })
    await expect(api.getMe()).rejects.toMatchObject({ message: 'Network error: bad json' })
  })
})

describe('api.ts — KomariApi post（私有，当前无导出方法调用 —— 钉住其行为）', () => {
  // post 是私有方法，重构前固定其协议形状；通过受控访问调用。
  function postOf(api: KomariApi) {
    return (api as unknown as { post: (path: string, body?: unknown) => Promise<unknown> }).post.bind(api)
  }

  it('POST 请求形状：method/headers/credentials/body JSON', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ body: { status: 'success', message: '', data: { ok: 1 } } }))
    const api = new KomariApi({ baseUrl: '/api' })
    const post = postOf(api)
    const res = await post('/login', { username: 'u', password: 'p' })
    expect(res).toEqual({ ok: 1 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/login')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(init.credentials).toBe('include')
    expect(JSON.parse(init.body)).toEqual({ username: 'u', password: 'p' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('无 body 时 body 为 undefined（不发送 JSON）', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ body: { status: 'success', message: '', data: 1 } }))
    const api = new KomariApi({ baseUrl: '/api' })
    await postOf(api)('/logout')
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined()
  })

  it('返回 set-cookie 结构时直接透传（登录特殊响应，不做 status 校验）', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({
      body: { 'set-cookie': 'session=abc', status: 'success' },
    }))
    const api = new KomariApi({ baseUrl: '/api' })
    await expect(postOf(api)('/login', {})).resolves.toEqual({ 'set-cookie': 'session=abc', status: 'success' })
  })

  it('status === "error" → ApiError(message, "error", HTTP status)', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({
      status: 403,
      ok: false,
      body: { status: 'error', message: 'forbidden', data: null },
    }))
    const api = new KomariApi({ baseUrl: '/api' })
    const err = await postOf(api)('/x', {}).catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.message).toBe('forbidden')
    expect(err.code).toBe(403)
  })

  it('body 为 null 时 result["set-cookie"] 访问失败 → 归为 Network error', async () => {
    // 记录行为：post 未做 response.ok 检查，但对 null 响应体会抛 TypeError 并被 catch 包装。
    fetchMock.mockResolvedValueOnce(fakeResponse({ body: null }))
    const api = new KomariApi({ baseUrl: '/api' })
    const err = await postOf(api)('/x', {}).catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.message.startsWith('Network error:')).toBe(true)
  })
})

describe('api.ts — RealtimeWebSocket', () => {
  it('默认 URL /api/clients；http→ws、https→wss 替换', () => {
    new RealtimeWebSocket()
    new RealtimeWebSocket({ baseUrl: 'http://host.test/api/clients' })
    new RealtimeWebSocket({ baseUrl: 'https://host.test/api/clients' })
    // 构造函数不建连接；仅在 connect 时实例化 WebSocket
    expect(MockWebSocket.instances.length).toBe(0)

    const a = new RealtimeWebSocket({ baseUrl: 'http://host.test/api/clients' })
    a.connect()
    expect(lastWs().url).toBe('ws://host.test/api/clients')

    const b = new RealtimeWebSocket({ baseUrl: 'https://host.test/api/clients' })
    b.connect()
    expect(lastWs().url).toBe('wss://host.test/api/clients')
  })

  it('connect：onopen 后发送字符串 "get" 并 resolve', async () => {
    const ws = new RealtimeWebSocket({ baseUrl: 'ws://host.test/api/clients' })
    const p = ws.connect()
    const sock = lastWs()
    sock.simulateOpen()
    await expect(p).resolves.toBeUndefined()
    expect(sock.sent).toEqual(['get'])
  })

  it('onmessage 解析 JSON 广播给订阅者；订阅返回取消函数', async () => {
    const ws = new RealtimeWebSocket({ baseUrl: 'ws://host.test/api/clients' })
    const listener = vi.fn()
    const unsubscribe = ws.subscribe(listener)
    const p = ws.connect()
    const sock = lastWs()
    sock.simulateOpen()
    await p
    const payload = { status: 'success', data: { online: ['a'], data: {} } }
    sock.simulateMessage(payload)
    expect(listener).toHaveBeenCalledWith(payload)
    unsubscribe()
    sock.simulateMessage(payload)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('onmessage 收到非法 JSON 被吞掉', async () => {
    const ws = new RealtimeWebSocket({ baseUrl: 'ws://host.test/api/clients' })
    const listener = vi.fn()
    ws.subscribe(listener)
    const p = ws.connect()
    lastWs().simulateOpen()
    await p
    expect(() => lastWs().simulateMessage('{bad')).not.toThrow()
    expect(listener).not.toHaveBeenCalled()
  })

  it('onerror：未打开时 reject(ApiError "WebSocket connection failed") 并通知 error 订阅者', async () => {
    const ws = new RealtimeWebSocket({ baseUrl: 'ws://host.test/api/clients' })
    const errListener = vi.fn()
    const unsubscribe = ws.onError(errListener)
    const p = ws.connect()
    lastWs().simulateError()
    await expect(p).rejects.toMatchObject({ name: 'ApiError', message: 'WebSocket connection failed' })
    expect(errListener).toHaveBeenCalledTimes(1)
    // 退订后不再收到错误
    unsubscribe()
    lastWs().simulateError()
    expect(errListener).toHaveBeenCalledTimes(1)
  })

  it('requestData：连接已打开时发送 "get"，未打开时不发', async () => {
    const ws = new RealtimeWebSocket({ baseUrl: 'ws://host.test/api/clients' })
    ws.requestData()
    const p = ws.connect()
    const sock = lastWs()
    sock.simulateOpen()
    await p
    const before = sock.sent.length
    ws.requestData()
    expect(sock.sent.length).toBe(before + 1)
    expect(sock.sent.at(-1)).toBe('get')
  })

  it('connected getter：打开为 true，关闭为 false', async () => {
    const ws = new RealtimeWebSocket({ baseUrl: 'ws://host.test/api/clients' })
    expect(ws.connected).toBe(false)
    const p = ws.connect()
    const sock = lastWs()
    sock.simulateOpen()
    await p
    expect(ws.connected).toBe(true)
    ws.close()
    expect(ws.connected).toBe(false)
  })

  it('close：关闭 socket、清空订阅者（禁用重连避免残留定时器）', async () => {
    const ws = new RealtimeWebSocket({ baseUrl: 'ws://host.test/api/clients', maxReconnectAttempts: 0 })
    const listener = vi.fn()
    const errListener = vi.fn()
    ws.subscribe(listener)
    ws.onError(errListener)
    const p = ws.connect()
    const sock = lastWs()
    sock.simulateOpen()
    await p
    ws.close()
    expect(sock.readyState).toBe(MockWebSocket.CLOSED)
    expect(ws.connected).toBe(false)
    // 订阅者被清空：再发消息不再触发
    sock.simulateMessage({ status: 'success', data: { online: [], data: {} } })
    expect(listener).not.toHaveBeenCalled()
  })

  it('onclose 触发自动重连（间隔后重新 connect，调用次数 +1）', async () => {
    vi.useFakeTimers()
    const ws = new RealtimeWebSocket({ baseUrl: 'ws://host.test/api/clients', reconnectInterval: 100, maxReconnectAttempts: 2 })
    const p = ws.connect()
    const sock = lastWs()
    sock.simulateOpen()
    await p
    expect(MockWebSocket.instances.length).toBe(1)
    sock.close() // 触发 onclose → attemptReconnect
    await vi.advanceTimersByTimeAsync(100)
    expect(MockWebSocket.instances.length).toBe(2)
  })

  it('重连次数不超过 maxReconnectAttempts', async () => {
    vi.useFakeTimers()
    const ws = new RealtimeWebSocket({ baseUrl: 'ws://host.test/api/clients', reconnectInterval: 10, maxReconnectAttempts: 2 })
    const p = ws.connect()
    lastWs().simulateOpen()
    await p
    // 连续 close 触发重连：每次 close 都重连，直到用尽 2 次
    lastWs().close()
    await vi.advanceTimersByTimeAsync(10)
    expect(MockWebSocket.instances.length).toBe(2)
    lastWs().close()
    await vi.advanceTimersByTimeAsync(10)
    expect(MockWebSocket.instances.length).toBe(3)
    lastWs().close()
    await vi.advanceTimersByTimeAsync(10)
    // 第 3 次 close 时已用尽 maxReconnectAttempts(2)，不再新建
    expect(MockWebSocket.instances.length).toBe(3)
  })

  it('重连失败被静默吞掉（attemptReconnect 内的 catch）', async () => {
    vi.useFakeTimers()
    const ws = new RealtimeWebSocket({ baseUrl: 'ws://host.test/api/clients', reconnectInterval: 50, maxReconnectAttempts: 1 })
    const p = ws.connect()
    lastWs().simulateOpen()
    await p
    lastWs().close()
    await vi.advanceTimersByTimeAsync(50)
    expect(MockWebSocket.instances.length).toBe(2)
    // 重连出的 socket 报错 → connect() reject，但被 .catch 吞掉，不产生未处理拒绝
    lastWs().simulateError()
    await vi.advanceTimersByTimeAsync(0)
    expect(MockWebSocket.instances.length).toBe(2)
  })

  it('构造函数 new WebSocket 抛错 → connect reject(ApiError "WebSocket error: ...")', async () => {
    const Original = MockWebSocket
    class ThrowingWs extends Original {
      constructor(url: string) {
        super(url)
        throw new TypeError('ctor failed')
      }
    }
    vi.stubGlobal('WebSocket', ThrowingWs as unknown as typeof WebSocket)
    const ws = new RealtimeWebSocket({ baseUrl: 'ws://host.test/api/clients' })
    await expect(ws.connect()).rejects.toMatchObject({ name: 'ApiError', message: 'WebSocket error: ctor failed' })
  })
})

describe('api.ts — 单例', () => {
  it('getSharedApi 返回同一实例（忽略后续 options）', () => {
    const a = getSharedApi({ baseUrl: '/api' })
    const b = getSharedApi({ baseUrl: '/other' })
    expect(a).toBe(b)
    expect(a).toBeInstanceOf(KomariApi)
  })

  it('resetSharedApi 后获得新实例', () => {
    const a = getSharedApi()
    resetSharedApi()
    const b = getSharedApi()
    expect(b).not.toBe(a)
  })
})
