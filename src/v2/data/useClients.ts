/**
 * 节点数据 composable：轮询刷新 + 错误/重试 + 加载态
 *
 * - 首次加载：loading=true，成功后置 false
 * - 轮询：intervalMs 定时刷新（走 refreshing，不清空旧数据）
 * - 失败：保留上一次数据，error 置文案，按指数退避重试（上限 backoffMaxMs）
 * - 可注入 fetcher（单测/e2e mock）
 */

import type { Ref } from 'vue'
import type { Fetcher } from './client'
import type { ClientsPayload } from './client'
import type { Node } from './types'
import { computed, getCurrentInstance, onScopeDispose, onMounted, ref, watch } from 'vue'
import { fetchClients } from './client'
import { buildNodes } from './nodeModel'

export interface UseClientsOptions {
  fetcher?: Fetcher
  /** 轮询间隔（ms），<=0 关闭轮询 */
  intervalMs?: number
  /** 挂载后是否立即加载（默认 true） */
  immediate?: boolean
  /** 退避上限（ms） */
  backoffMaxMs?: number
  /** 组件内自动在 onMounted 启动、卸载时停止（默认 true） */
  autoLifecycle?: boolean
}

export interface UseClientsResult {
  nodes: Ref<Node[]>
  raw: Ref<ClientsPayload | null>
  loading: Ref<boolean>
  refreshing: Ref<boolean>
  error: Ref<string | null>
  lastUpdated: Ref<number | null>
  failures: Ref<number>
  load: (isInitial?: boolean) => Promise<void>
  refresh: () => Promise<void>
  retry: () => Promise<void>
  start: () => void
  stop: () => void
}

export function useClients(options: UseClientsOptions = {}): UseClientsResult {
  const intervalMs = options.intervalMs ?? 5000
  const backoffMaxMs = options.backoffMaxMs ?? 60000
  const autoLifecycle = options.autoLifecycle ?? true

  const raw = ref<ClientsPayload | null>(null)
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref<string | null>(null)
  const lastUpdated = ref<number | null>(null)
  const failures = ref(0)

  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = true

  const nodes = computed<Node[]>(() => buildNodes(raw.value?.nodes, raw.value?.statuses))

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function schedule(delay: number) {
    clearTimer()
    if (stopped || delay < 0)
      return
    timer = setTimeout(() => {
      void load(false)
    }, delay)
  }

  async function load(isInitial = false): Promise<void> {
    if (isInitial)
      loading.value = true
    else
      refreshing.value = true
    try {
      const payload = await fetchClients({ fetcher: options.fetcher })
      raw.value = payload
      lastUpdated.value = Date.now()
      error.value = null
      failures.value = 0
      if (isInitial)
        loading.value = false
      refreshing.value = false
      schedule(intervalMs)
    }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      error.value = msg || '获取数据失败'
      failures.value++
      loading.value = false
      refreshing.value = false
      // 指数退避重试
      const backoff = Math.min(intervalMs * 2 ** Math.min(failures.value, 6), backoffMaxMs)
      schedule(backoff || 3000)
    }
  }

  async function refresh(): Promise<void> {
    // 手动刷新：清掉待执行的定时，立刻拉一次
    clearTimer()
    await load(raw.value === null)
  }

  async function retry(): Promise<void> {
    error.value = null
    await load(raw.value === null)
  }

  function start() {
    if (!stopped)
      return
    stopped = false
    schedule(0)
  }

  function stop() {
    stopped = true
    clearTimer()
  }

  if (autoLifecycle && getCurrentInstance()) {
    onMounted(() => {
      if (options.immediate ?? true)
        start()
    })
    onScopeDispose(() => stop())
  }

  // 间隔变化时重排定时
  watch(() => intervalMs, () => {
    if (!stopped && !error.value)
      schedule(intervalMs)
  })

  return {
    nodes,
    raw,
    loading,
    refreshing,
    error,
    lastUpdated,
    failures,
    load,
    refresh,
    retry,
    start,
    stop,
  }
}
