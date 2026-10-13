import type { Fetcher } from '@/v2/data/client'
import type { RawClient, RawStatus } from '@/v2/data/types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import HomeView from '@/v2/views/HomeView.vue'
import { CLIENTS_FETCHER_KEY } from '@/v2/data/injectionKeys'

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'fixtures', 'clients.sample.json'), 'utf8'),
) as { nodes: Record<string, RawClient>, statuses: Record<string, RawStatus> }

/** 按 JSON-RPC method 分派的 mock fetcher（同 data 层单测口径） */
function fixtureFetcher(): Fetcher {
  return async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { id: unknown, method: string }
    const result = body.method === 'common:getNodes'
      ? fixture.nodes
      : body.method === 'common:getNodesLatestStatus'
        ? fixture.statuses
        : {}
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), { status: 200 })
  }
}

const TOTAL_NODES = Object.keys(fixture.nodes).length

/**
 * 等首屏数据落定。
 * 不能用「固定 flush 轮数」：全量并行跑时异步链更慢，固定轮数会早查（曾导致同一批用例
 * 在不同 run 里交替失败、单跑却全绿）。改为轮询条件 —— 卡片数达到 fixture 规模才返回。
 */
async function waitUntil(pred: () => boolean, timeoutMs = 4000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await flushPromises()
    await nextTick()
    if (pred())
      return
  }
}

async function mountHome() {
  const wrapper = mount(HomeView, {
    global: {
      // teleport 渲染到就地，便于断言卡片数量
      stubs: { teleport: true },
      provide: { [CLIENTS_FETCHER_KEY]: fixtureFetcher() },
    },
  })
  await waitUntil(() => wrapper.findAll('.vk-node-card').length === TOTAL_NODES)
  return wrapper
}

describe('HomeView：装配真实首页', () => {
  it('渲染与 fixture 节点数一致的卡片，且都是 NodeCard', async () => {
    const wrapper = await mountHome()
    const cards = wrapper.findAll('.vk-node-card')
    expect(cards).toHaveLength(Object.keys(fixture.nodes).length)
    for (const c of cards) {
      expect(c.classes()).toContain('vk-panel')
      expect(c.attributes('data-node-id')).toBeTruthy()
    }
    wrapper.unmount()
  })

  it('渲染顶部总览，在线/总数只计纯在线（不含告警）', async () => {
    const wrapper = await mountHome()
    const overview = wrapper.find('[data-testid="overview"]')
    expect(overview.exists()).toBe(true)
    const online = wrapper.findAll('.vk-node-card[data-status="online"]').length
    const alert = wrapper.findAll('.vk-node-card[data-status="alert"]').length
    // fixture 同时存在在线与告警节点，才能证明「在线」不再吞掉「告警」
    expect(online).toBeGreaterThan(0)
    expect(alert).toBeGreaterThan(0)
    expect(wrapper.find('[data-field="online"] .vk-overview-value').text())
      .toBe(`${online} / ${Object.keys(fixture.nodes).length}`)
    // 告警数 > 0 → 总览额外显示「告警」项，且与卡片告警数一致
    expect(wrapper.find('[data-field="alert"] .vk-overview-value').text()).toBe(String(alert))
    wrapper.unmount()
  })

  it('底部摘要明确拆开 共/在线/告警/未知（不再含糊）', async () => {
    const wrapper = await mountHome()
    const summary = wrapper.find('[data-testid="home-summary"]')
    expect(summary.exists()).toBe(true)
    const text = summary.text()
    expect(text).toContain('共')
    expect(text).toContain('在线')
    expect(text).toContain('告警')
    expect(text).toContain('未知')
    expect(text).not.toContain('口径见卡片状态')
    wrapper.unmount()
  })

  it('默认排序：在线优先（卡片顺序里在线/告警状态先出现）', async () => {
    const wrapper = await mountHome()
    const statuses = wrapper.findAll('.vk-node-card').map(n => n.attributes('data-status'))
    const firstUnknown = statuses.indexOf('unknown')
    if (firstUnknown !== -1) {
      // unknown 全排在在线之后
      expect(statuses.slice(0, firstUnknown).every(s => s !== 'unknown')).toBe(true)
    }
    wrapper.unmount()
  })

  it('数据加载失败：显示错误文案且不抛错', async () => {
    const failing: Fetcher = async () => new Response('boom', { status: 500 })
    const wrapper = mount(HomeView, {
      global: { stubs: { teleport: true }, provide: { [CLIENTS_FETCHER_KEY]: failing } },
    })
    // 错误路径不会有卡片，故等「错误元素出现」而不是等卡片（固定 flush 轮数在并行负载下会早查）
    await waitUntil(() => wrapper.find('[data-testid="home-error"]').exists())
    expect(wrapper.find('[data-testid="home-error"]').exists()).toBe(true)
    expect(wrapper.findAll('.vk-node-card')).toHaveLength(0)
    wrapper.unmount()
  })
})
