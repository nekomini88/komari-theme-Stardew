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

async function settle() {
  await flushPromises()
  await nextTick()
  await flushPromises()
  await nextTick()
}

async function mountHome(fetcher: Fetcher) {
  const wrapper = mount(HomeView, {
    global: {
      stubs: { teleport: true },
      provide: { [CLIENTS_FETCHER_KEY]: fetcher },
    },
  })
  await settle()
  return wrapper
}

const TOTAL = Object.keys(fixture.nodes).length

describe('HomeView：搜索/筛选/排序 UI 绑定（复用 nodeModel 纯函数）', () => {
  it('渲染工具栏，初始显示全部节点', async () => {
    const w = await mountHome(fixtureFetcher())
    expect(w.find('[data-testid="node-toolbar"]').exists()).toBe(true)
    expect(w.findAll('.vk-node-card')).toHaveLength(TOTAL)
    expect(w.find('[data-testid="node-count"]').text()).toContain(String(TOTAL))
    w.unmount()
  })

  it('搜索无匹配词 → 卡片清零并显示「没有匹配的节点」空态', async () => {
    const w = await mountHome(fixtureFetcher())
    await w.find('[data-testid="node-search"]').setValue('zzz-definitely-not-exist')
    await nextTick()
    expect(w.findAll('.vk-node-card')).toHaveLength(0)
    expect(w.find('[data-testid="home-empty"]').exists()).toBe(true)
    w.unmount()
  })

  it('搜索命中某节点名 → 只剩该项', async () => {
    const w = await mountHome(fixtureFetcher())
    const name = Object.values(fixture.nodes)[0]!.name || ''
    const key = name.slice(0, 2)
    await w.find('[data-testid="node-search"]').setValue(key)
    await nextTick()
    const shown = w.findAll('.vk-node-card')
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThanOrEqual(TOTAL)
    for (const c of shown)
      expect(c.find('.vk-card-name').text().toLowerCase()).toContain(key.toLowerCase())
    w.unmount()
  })

  it('状态筛选「在线」→ 所有卡片为 在线/告警', async () => {
    const w = await mountHome(fixtureFetcher())
    await w.find('[data-testid="node-status-online"]').trigger('click')
    await nextTick()
    const statuses = w.findAll('.vk-node-card').map(n => n.attributes('data-status'))
    expect(statuses.every(s => s === 'online' || s === 'alert')).toBe(true)
    w.unmount()
  })

  it('排序切到 名称 升序 → 卡片按 localeCompare 排列', async () => {
    const w = await mountHome(fixtureFetcher())
    await w.find('[data-testid="node-sort"]').setValue('name')
    await nextTick()
    const names = w.findAll('.vk-card-name').map(n => n.text())
    const sorted = [...names].sort((a, b) => a.localeCompare(b))
    expect(names).toEqual(sorted)
    w.unmount()
  })
})

describe('HomeView：加载/空/错误三态', () => {
  it('空数据（成功但无节点）→ home-empty 占位', async () => {
    const emptyFetcher: Fetcher = async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { id: unknown }
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {} }), { status: 200 })
    }
    const w = await mountHome(emptyFetcher)
    expect(w.find('[data-testid="home-empty"]').exists()).toBe(true)
    expect(w.findAll('.vk-node-card')).toHaveLength(0)
    w.unmount()
  })

  it('拉取失败 → home-error 占位 + 重试按钮；重试成功后渲染卡片', async () => {
    let fail = true
    const flaky: Fetcher = async (_url, init) => {
      if (fail)
        return new Response('boom', { status: 500 })
      const body = JSON.parse(String(init?.body ?? '{}')) as { id: unknown, method: string }
      const result = body.method === 'common:getNodes' ? fixture.nodes : fixture.statuses
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), { status: 200 })
    }
    const w = await mountHome(flaky)
    expect(w.find('[data-testid="home-error"]').exists()).toBe(true)
    const retry = w.find('[data-testid="state-retry"]')
    expect(retry.exists()).toBe(true)

    fail = false
    await retry.trigger('click')
    await settle()
    expect(w.find('[data-testid="home-error"]').exists()).toBe(false)
    expect(w.findAll('.vk-node-card')).toHaveLength(TOTAL)
    w.unmount()
  })
})
