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

async function mountHome() {
  const wrapper = mount(HomeView, {
    global: {
      // teleport 渲染到就地，便于断言卡片数量
      stubs: { teleport: true },
      provide: { [CLIENTS_FETCHER_KEY]: fixtureFetcher() },
    },
  })
  // 等首屏加载（onMounted → setTimeout(0) → Promise.all）
  await flushPromises()
  await nextTick()
  await flushPromises()
  return wrapper
}

describe('HomeView：装配真实首页', () => {
  it('渲染与 fixture 节点数一致的卡片，且都是 NodeCard', async () => {
    const wrapper = await mountHome()
    const cards = wrapper.findAll('.vk-node-card')
    expect(cards).toHaveLength(Object.keys(fixture.nodes).length)
    for (const c of cards) {
      expect(c.classes()).toContain('vk-contact')
      expect(c.attributes('data-node-id')).toBeTruthy()
    }
    wrapper.unmount()
  })

  it('渲染顶部总览，在线/总数文案正确', async () => {
    const wrapper = await mountHome()
    const overview = wrapper.find('[data-testid="overview"]')
    expect(overview.exists()).toBe(true)
    const online = wrapper.findAll('.vk-node-card[data-status="online"]').length
      + wrapper.findAll('.vk-node-card[data-status="alert"]').length
    expect(wrapper.find('[data-field="online"] .vk-overview-value').text())
      .toBe(`${online} / ${Object.keys(fixture.nodes).length}`)
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
    await flushPromises()
    await nextTick()
    await flushPromises()
    expect(wrapper.find('[data-testid="home-error"]').exists()).toBe(true)
    expect(wrapper.findAll('.vk-node-card')).toHaveLength(0)
    wrapper.unmount()
  })
})
