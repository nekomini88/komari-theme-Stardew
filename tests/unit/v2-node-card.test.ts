import type { Node, RawClient, RawStatus } from '@/v2/data/types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import NodeCard from '@/v2/components/NodeCard.vue'
import { assignAccents, buildNodes, pickPingStats } from '@/v2/data/nodeModel'
import {
  formatBytes,
  formatBytesPerSecond,
  formatDate,
  formatLatency,
  formatLoad,
  formatLoadPercent,
  formatLoss,
  formatPercent,
  formatUptime,
} from '@/v2/data/metrics'
import { nodeViewStatus } from '@/v2/data/nodeStatus'

const ROOT = resolve(__dirname, '..', '..')

/** WCAG 相对亮度 → 对比度（用于校验「彩色标题栏 + 承色字」配对） */
function contrast(hexA: string, hexB: string): number {
  const lum = (h: string) => {
    const v = h.replace('#', '')
    const ch = [0, 2, 4].map(i => Number.parseInt(v.slice(i, i + 2), 16) / 255)
    const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(ch[0]!) + 0.7152 * f(ch[1]!) + 0.0722 * f(ch[2]!)
  }
  const [la, lb] = [lum(hexA), lum(hexB)]
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

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

  it('每项指标行都带一个小图标（CPU/内存/硬盘 + 9 项明细）', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    // CPU/内存/硬盘三行各一个
    expect(w.findAll('.vk-card-metric .vk-icon-inline').length).toBe(3)
    // 明细 9 项（下行/上行/累计↓/累计↑/负载/在线/延迟/丢包/到期）各一个
    // —— 本轮按 DESIGN_REFERENCE §6 补齐「丢包 Packet Loss」，故由 8 项变 9 项
    expect(w.findAll('.vk-fact dt .vk-icon-inline').length).toBe(9)
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
    // 兼容探针/e2e 的短选择器 `.vk-card`（根节点同时挂 vk-node-card 与 vk-card）
    expect(card.classes()).toContain('vk-card')
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

describe('NodeCard：彩色标题栏整块上色（每台一个主题色 + 配对承色字）', () => {
  /** 从 tokens.css 取某个令牌的 hex 值 */
  const tokenHex = (name: string): string | undefined => {
    const css = readFileSync(resolve(ROOT, 'src', 'styles', 'v2', 'tokens.css'), 'utf8')
    return (css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`)) ?? [])[1]
  }

  it('卡片根节点成对下发 --vk-node-accent 与 --vk-node-ink', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const style = w.find('.vk-node-card').attributes('style') ?? ''
    expect(style).toContain('--vk-node-accent: var(--vk-card-accent-')
    expect(style).toContain('--vk-node-ink: var(--vk-card-ink-')
  })

  it('同一台每次同色；不同节点能落到不同主题色（可辨、不串色）', () => {
    const styleOf = (n: Node) => mount(NodeCard, { props: { node: n } })
      .find('.vk-node-card').attributes('style')
    expect(styleOf(frankfurt)).toBe(styleOf(frankfurt))
    const distinct = new Set(nodes.map(n => styleOf(n)))
    expect(distinct.size).toBeGreaterThan(1)
  })

  it('tokens.css：6 组 accent/ink 成对定义，且每组对比度 ≥4.5:1（WCAG 相对亮度实算）', () => {
    for (let i = 1; i <= 6; i++) {
      const bg = tokenHex(`--vk-card-accent-${i}`)
      const ink = tokenHex(`--vk-card-ink-${i}`)
      expect(bg, `--vk-card-accent-${i} 缺失`).toBeTruthy()
      expect(ink, `--vk-card-ink-${i} 缺失`).toBeTruthy()
      expect(contrast(bg!, ink!), `第 ${i} 组 ${bg}/${ink} 对比度不足`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('card.css：标题栏整块取 --vk-node-accent，承色字取 --vk-node-ink（不再 55% 混纸底）', () => {
    const css = readFileSync(resolve(ROOT, 'src', 'styles', 'v2', 'card.css'), 'utf8')
    expect(css).toMatch(/\.vk-card-head\s*\{[^}]*background-color:\s*var\(--vk-node-accent/)
    expect(css).toMatch(/\.vk-card-head\s*\{[^}]*color:\s*var\(--vk-node-ink/)
    expect(css).toMatch(/\.vk-card-name\s*\{[^}]*color:\s*var\(--vk-node-ink/)
    // 旧的「混 55% 米纸」写法必须已移除（否则标题栏仍发白）
    expect(css).not.toMatch(/--vk-node-accent[^)]*\)\s*55%/)
  })
})

describe('NodeCard：丢包 Packet Loss（DESIGN_REFERENCE §6 指标清单）', () => {
  it('渲染 formatLoss(node.loss) 且带 data-field=loss', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    expect(text(w, 'loss')).toBe(formatLoss(frankfurt.loss))
  })

  it('无丢包数据 → —', () => {
    const none: Node = { ...frankfurt, loss: null }
    const w = mount(NodeCard, { props: { node: none } })
    expect(text(w, 'loss')).toBe('—')
  })

  it('延迟与丢包取自同一个 Ping 任务（口径一致）', () => {
    const ping = { a: { avg: 30, loss: 1.5 }, b: { avg: 12, loss: 7.25 } }
    expect(pickPingStats(ping)).toEqual({ latency: 12, loss: 7.25 })
    // 全丢包 / 空 → 两者皆 null
    expect(pickPingStats({ a: { avg: -1 } })).toEqual({ latency: null, loss: null })
    expect(pickPingStats(undefined)).toEqual({ latency: null, loss: null })
  })

  it('buildNode 把丢包挂到 Node 上（与 latency 同源任务）', () => {
    const withStatus = nodes.find(n => n.hasStatus)!
    const st = fixture.statuses[withStatus.uuid]!
    expect(withStatus.loss).toBe(pickPingStats(st.ping).loss)
  })
})

describe('assignAccents：同批主题色互不重复（参考稿 6 卡 6 色）', () => {
  it('≤6 台 → 两两不同色，且同一集合结果稳定', () => {
    const uuids = nodes.map(n => n.uuid)
    const a = assignAccents(uuids)
    const b = assignAccents(uuids)
    expect([...a.entries()]).toEqual([...b.entries()])
    expect(new Set(a.values()).size).toBe(Math.min(uuids.length, 6))
  })

  it('顺序无关（传入顺序不同 → 结果一致）', () => {
    const uuids = nodes.map(n => n.uuid)
    const a = assignAccents(uuids)
    const b = assignAccents([...uuids].reverse())
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort())
  })

  it('>6 台 → 回绕到 6 个槽位', () => {
    const many = Array.from({ length: 9 }, (_, i) => `uuid-${i}`)
    const m = assignAccents(many)
    expect(m.size).toBe(9)
    for (const v of m.values()) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(6)
    }
  })

  it('空输入 → 空表', () => {
    expect(assignAccents([]).size).toBe(0)
  })
})
