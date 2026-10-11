import type { Node, RawClient, RawStatus } from '@/v2/data/types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import NodeCard from '@/v2/components/NodeCard.vue'
import { buildNodes } from '@/v2/data/nodeModel'
import {
  formatBytes,
  formatBytesPerSecond,
  formatDate,
  formatLatency,
  formatLoad,
  formatLoadPercent,
  formatPercent,
  formatUptime,
} from '@/v2/data/metrics'
import { nodeViewStatus } from '@/v2/data/nodeStatus'

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'fixtures', 'clients.sample.json'), 'utf8'),
) as { nodes: Record<string, RawClient>, statuses: Record<string, RawStatus> }

const nodes: Node[] = buildNodes(fixture.nodes, fixture.statuses)
const frankfurt = nodes.find(n => n.name === '法兰克福free')!
const heavy = nodes.find(n => n.uuid.startsWith('7b842e5b'))!

function text(wrapper: ReturnType<typeof mount>, field: string): string {
  return wrapper.find(`[data-field="${field}"]`).text()
}

describe('NodeCard：真实 fixture 渲染关键指标（走 metrics 格式化）', () => {
  it('法兰克福free：CPU/内存/硬盘/流量/负载/时长/延迟均为 metrics 输出', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })

    expect(text(w, 'cpu')).toBe(formatPercent(frankfurt.cpu, 100))
    expect(text(w, 'mem')).toBe(formatPercent(frankfurt.ram, frankfurt.ramTotal))
    expect(text(w, 'disk')).toBe(formatPercent(frankfurt.disk, frankfurt.diskTotal))
    expect(text(w, 'mem-detail')).toBe(`${formatBytes(frankfurt.ram)} / ${formatBytes(frankfurt.ramTotal)}`)
    expect(text(w, 'disk-detail')).toBe(`${formatBytes(frankfurt.disk)} / ${formatBytes(frankfurt.diskTotal)}`)
    expect(text(w, 'net-in')).toBe(formatBytesPerSecond(frankfurt.netIn))
    expect(text(w, 'net-out')).toBe(formatBytesPerSecond(frankfurt.netOut))
    expect(text(w, 'load')).toBe(`${formatLoad(frankfurt.load)} (${formatLoadPercent(frankfurt.load, frankfurt.cpuCores)})`)
    expect(text(w, 'uptime')).toBe(formatUptime(frankfurt.uptime))
    expect(text(w, 'latency')).toBe(formatLatency(frankfurt.latency))
    expect(text(w, 'traffic-down')).toBe(formatBytes(frankfurt.netTotalDown))
    expect(text(w, 'expire')).toBe(formatDate(frankfurt.expiredAt))
  })

  it('具体数值抽查：CPU 文案带 %，名称/地区/系统在位', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    expect(text(w, 'cpu')).toMatch(/%$/)
    expect(w.find('.vk-card-name').text()).toBe('法兰克福free')
    expect(w.find('.vk-card-region').text()).toBe('🇩🇪')
    expect(w.find('.vk-card-os').text()).toBe(frankfurt.os)
  })

  it('进度条宽度 = percentValue（0..100）', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const fills = w.findAll('.vk-meter-fill')
    expect(fills.length).toBe(3)
    for (const f of fills) {
      const style = f.attributes('style') ?? ''
      const m = style.match(/width:\s*([\d.]+)%/)
      expect(m).not.toBeNull()
      const n = Number(m![1])
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThanOrEqual(100)
    }
  })
})

describe('NodeCard：状态用颜色 + 文字双重区分', () => {
  it('在线节点 → data-status=online 且文案「在线」', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    expect(nodeViewStatus(frankfurt)).toBe('online')
    expect(w.attributes('data-status')).toBe('online')
    const badge = w.find('.vk-card-status')
    expect(badge.attributes('data-status')).toBe('online')
    expect(badge.text()).toBe('在线')
  })

  it('高占用节点 → alert 且文案「告警」，不是只换个颜色', () => {
    const w = mount(NodeCard, { props: { node: heavy } })
    expect(nodeViewStatus(heavy)).toBe('alert')
    expect(w.attributes('data-status')).toBe('alert')
    expect(w.find('.vk-card-status').text()).toBe('告警')
  })

  it('离线节点（合成）→ offline 且文案「离线」', () => {
    const offline: Node = { ...frankfurt, online: false, hasStatus: true, status: 'offline' }
    const w = mount(NodeCard, { props: { node: offline } })
    expect(w.attributes('data-status')).toBe('offline')
    expect(w.find('.vk-card-status').text()).toBe('离线')
  })

  it('无状态节点 → unknown 且文案「未知」', () => {
    const unknown: Node = { ...frankfurt, hasStatus: false, online: false, status: 'unknown', latency: null }
    const w = mount(NodeCard, { props: { node: unknown } })
    expect(w.attributes('data-status')).toBe('unknown')
    expect(w.find('.vk-card-status').text()).toBe('未知')
  })
})

describe('NodeCard：彩色标题栏 + 指标小图标 + Expire（原帖 mockup 对齐）', () => {
  it('标题栏：名称唯一不重复，且带 left 图标 + 状态签', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const head = w.find('.vk-card-head')
    // 标题栏仅出现一次名称，且与节点名一致（不重复渲染）
    expect(w.findAll('.vk-card-name').length).toBe(1)
    expect(w.find('.vk-card-name').text()).toBe(frankfurt.name)
    expect(head.find('.vk-card-head-icon').exists()).toBe(true)
    expect(head.find('.vk-card-status').exists()).toBe(true)
  })

  it('每项指标行都带一个小图标（CPU/内存/硬盘 + 7 项明细）', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    // CPU/内存/硬盘三行各一个
    expect(w.findAll('.vk-card-metric .vk-icon-inline').length).toBe(3)
    // 明细 8 项（下行/上行/负载/在线/累计↓/累计↑/延迟/到期）各一个
    expect(w.findAll('.vk-fact dt .vk-icon-inline').length).toBe(8)
  })

  it('Expire：有 expired_at 显示日期，缺失显示 —', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    expect(text(w, 'expire')).toBe(formatDate(frankfurt.expiredAt))
    expect(text(w, 'expire')).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const none: Node = { ...frankfurt, expiredAt: null }
    const w2 = mount(NodeCard, { props: { node: none } })
    expect(text(w2, 'expire')).toBe('—')
  })
})

describe('NodeCard：视觉契约（母板/tokens/接触阴影）', () => {
  it('卡片带 vk-contact（接触阴影），不再带像素类，并有 uuid 锚点', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const card = w.find('.vk-node-card')
    expect(card.classes()).toContain('vk-contact')
    expect(card.classes()).not.toContain('vk-pixel')
    expect(card.attributes('data-node-id')).toBe(frankfurt.uuid)
  })

  it('card.css：无裸 hex，取色仅走 var(--vk-*)（母板令牌），且已去像素化', () => {
    const raw = readFileSync(resolve(__dirname, '..', '..', 'src', 'styles', 'v2', 'card.css'), 'utf8')
    // 只断言"真实声明"，注释里说明性的提及（如"已去 image-rendering: pixelated"）不算违规
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/) // 不出现裸 hex，全部经令牌
    expect(css).not.toContain('image-rendering: pixelated')
    // 新口径(照 DESIGN_REFERENCE §6):卡片改 3×2 grid 排布,不再用 bottom:22% 绝对定位贴 ground 基线
    expect(css).toMatch(/display:\s*grid/)
    expect(css).toMatch(/grid-template-columns:\s*repeat\(3/)
  })
})
