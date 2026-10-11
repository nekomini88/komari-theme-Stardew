import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import NodeToolbar from '@/v2/components/NodeToolbar.vue'
import StatePlaceholder from '@/v2/components/StatePlaceholder.vue'

function mountToolbar(overrides: Record<string, unknown> = {}) {
  return mount(NodeToolbar, {
    props: {
      query: '',
      sortKey: 'default',
      sortDir: 'asc',
      group: '',
      status: 'all',
      groups: ['东京', '法兰克福'],
      visibleCount: 2,
      totalCount: 3,
      ...overrides,
    } as never,
  })
}

describe('NodeToolbar：搜索/排序/分组/状态 绑定与 emit', () => {
  it('搜索框输入 → emit update:query', async () => {
    const w = mountToolbar()
    const input = w.find('[data-testid="node-search"]')
    await input.setValue('东京')
    const ev = w.emitted('update:query')
    expect(ev).toBeTruthy()
    expect(ev![ev!.length - 1]).toEqual(['东京'])
  })

  it('排序下拉切换 → emit update:sortKey', async () => {
    const w = mountToolbar()
    await w.find('[data-testid="node-sort"]').setValue('cpu')
    expect(w.emitted('update:sortKey')!.at(-1)).toEqual(['cpu'])
  })

  it('方向按钮：升序→降序切换 emit update:sortDir；默认排序时禁用', async () => {
    const w = mountToolbar({ sortKey: 'cpu', sortDir: 'asc' })
    const btn = w.find('[data-testid="node-sort-dir"]')
    expect(btn.attributes('disabled')).toBeUndefined()
    await btn.trigger('click')
    expect(w.emitted('update:sortDir')!.at(-1)).toEqual(['desc'])

    const w2 = mountToolbar({ sortKey: 'default' })
    expect(w2.find('[data-testid="node-sort-dir"]').attributes('disabled')).toBeDefined()
  })

  it('分组下拉含传入分组 → emit update:group', async () => {
    const w = mountToolbar()
    const opts = w.findAll('[data-testid="node-group"] option').map(o => o.attributes('value'))
    expect(opts).toContain('东京')
    await w.find('[data-testid="node-group"]').setValue('东京')
    expect(w.emitted('update:group')!.at(-1)).toEqual(['东京'])
  })

  it('状态筛选按钮 → emit update:status，且带文字（不只靠颜色）', async () => {
    const w = mountToolbar()
    const online = w.find('[data-testid="node-status-online"]')
    expect(online.text()).toBe('在线') // 文字表达
    await online.trigger('click')
    expect(w.emitted('update:status')!.at(-1)).toEqual(['online'])

    const w2 = mountToolbar({ status: 'offline' })
    expect(w2.find('[data-testid="node-status-offline"]').attributes('data-active')).toBe('true')
  })

  it('状态筛选含「告警」按钮（顺序 全部/在线/告警/离线/未知），点击 emit alert', async () => {
    const w = mountToolbar()
    const btns = w.findAll('.vk-status-btn')
    expect(btns.map(b => b.attributes('data-status'))).toEqual(['all', 'online', 'alert', 'offline', 'unknown'])
    const alert = w.find('[data-testid="node-status-alert"]')
    expect(alert.text()).toBe('告警')
    await alert.trigger('click')
    expect(w.emitted('update:status')!.at(-1)).toEqual(['alert'])
  })

  it('显示 可见/总数 计数', () => {
    const w = mountToolbar({ visibleCount: 1, totalCount: 3 })
    expect(w.find('[data-testid="node-count"]').text()).toContain('1')
    expect(w.find('[data-testid="node-count"]').text()).toContain('3')
  })
})

describe('StatePlaceholder：加载 / 空 / 错误 三态', () => {
  it('加载态 → testid=home-loading，文案「载入中…」，无重试', () => {
    const w = mount(StatePlaceholder, { props: { state: 'loading' } })
    expect(w.attributes('data-testid')).toBe('home-loading')
    expect(w.find('[data-testid="state-text"]').text()).toBe('载入中…')
    expect(w.find('[data-testid="state-retry"]').exists()).toBe(false)
  })

  it('空态 → testid=home-empty，可覆盖文案', () => {
    const w = mount(StatePlaceholder, { props: { state: 'empty', message: '没有匹配的节点' } })
    expect(w.attributes('data-testid')).toBe('home-empty')
    expect(w.find('[data-testid="state-text"]').text()).toBe('没有匹配的节点')
  })

  it('错误态 → testid=home-error，含重试按钮，点击 emit retry', async () => {
    const w = mount(StatePlaceholder, { props: { state: 'error', detail: 'HTTP 500' } })
    expect(w.attributes('data-testid')).toBe('home-error')
    expect(w.text()).toContain('HTTP 500')
    const retry = w.find('[data-testid="state-retry"]')
    expect(retry.exists()).toBe(true)
    await retry.trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })

  it('三态均带图形标记（不只靠颜色表意）', () => {
    for (const state of ['loading', 'empty', 'error'] as const) {
      const w = mount(StatePlaceholder, { props: { state } })
      expect(w.find('.vk-state-mark').exists()).toBe(true)
    }
  })
})
