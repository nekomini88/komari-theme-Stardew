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
  formatLoss,
  formatPercent,
  formatUptime,
  percentValue,
} from '@/v2/data/metrics'
import { nodeViewStatus } from '@/v2/data/nodeStatus'
import { getRegionCode } from '@/utils/regionHelper'

const ROOT = resolve(__dirname, '..', '..')

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'fixtures', 'clients.sample.json'), 'utf8'),
) as { nodes: Record<string, RawClient>, statuses: Record<string, RawStatus> }

const nodes: Node[] = buildNodes(fixture.nodes, fixture.statuses)
const frankfurt = nodes.find(n => n.name === '法兰克福free')!
const heavy = nodes.find(n => n.uuid.startsWith('7b842e5b'))!

function text(wrapper: ReturnType<typeof mount>, field: string): string {
  return wrapper.find(`[data-field="${field}"]`).text()
}

describe('NodeCard 数据：关键指标一律走 metrics 格式化', () => {
  it('百分比与速率/累计/延迟/到期/时长都是 metrics 输出', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })

    expect(text(w, 'cpu')).toBe(formatPercent(frankfurt.cpu, 100))
    expect(text(w, 'mem')).toBe(formatPercent(frankfurt.ram, frankfurt.ramTotal))
    expect(text(w, 'disk')).toBe(formatPercent(frankfurt.disk, frankfurt.diskTotal))
    expect(text(w, 'load')).toBe(formatLoad(frankfurt.load))
    expect(text(w, 'net-out')).toBe(formatBytesPerSecond(frankfurt.netOut)) // ↑Upload
    expect(text(w, 'net-in')).toBe(formatBytesPerSecond(frankfurt.netIn)) // ↓Download
    expect(text(w, 'traffic-up')).toBe(formatBytes(frankfurt.netTotalUp)) // Outbound
    expect(text(w, 'traffic-down')).toBe(formatBytes(frankfurt.netTotalDown)) // Inbound
    expect(text(w, 'latency')).toBe(formatLatency(frankfurt.latency))
    expect(text(w, 'loss')).toBe(formatLoss(frankfurt.loss))
    expect(text(w, 'uptime')).toBe(formatUptime(frankfurt.uptime))
    expect(text(w, 'expire')).toBe(formatDate(frankfurt.expiredAt))
  })

  it('延迟与丢包取自同一 Ping 任务（口径一致）', () => {
    const ping = pickPingStats(frankfurt.ping)
    expect(formatLatency(frankfurt.latency)).toBe(formatLatency(ping.latency))
    expect(formatLoss(frankfurt.loss)).toBe(formatLoss(ping.loss))
  })

  it('Expire：有 expired_at 显示日期，缺失显示 —', () => {
    const w1 = mount(NodeCard, { props: { node: frankfurt } })
    expect(text(w1, 'expire')).toBe(formatDate(frankfurt.expiredAt))

    const noExpire: Node = { ...frankfurt, expiredAt: null }
    const w2 = mount(NodeCard, { props: { node: noExpire } })
    expect(text(w2, 'expire')).toBe('—')
  })

  it('进度条宽度 = percentValue（0..100），共 6 条', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const fills = w.findAll('.vk-seg-fill')
    expect(fills).toHaveLength(6)

    const widthOf = (i: number) => fills[i]!.attributes('style') ?? ''
    expect(widthOf(0)).toContain(`${percentValue(frankfurt.cpu, 100)}%`)
    expect(widthOf(1)).toContain(`${percentValue(frankfurt.ram, frankfurt.ramTotal)}%`)
    expect(widthOf(2)).toContain(`${percentValue(frankfurt.disk, frankfurt.diskTotal)}%`)
    expect(widthOf(3)).toContain(`${percentValue(frankfurt.load, frankfurt.cpuCores)}%`)
  })
})

describe('NodeCard 结构：木牌面板（复刻参考稿）', () => {
  it('标题栏：名称唯一 + 叶片装饰 + 状态圆点 + 每台一色', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const heads = w.findAll('.vk-card-head')
    expect(heads).toHaveLength(1)
    expect(w.findAll('.vk-card-name')).toHaveLength(1)
    expect(w.find('.vk-card-name').text()).toBe('法兰克福free')
    expect(w.find('.vk-panel-vine').exists()).toBe(true)
    expect(w.find('.vk-panel-dot').exists()).toBe(true)
    // 标题栏底色由「每台一色」的 accent 派生（参考稿就是每台一色）
    const css = readFileSync(resolve(ROOT, 'src/styles/v2/card.css'), 'utf8')
    expect(css).toMatch(/\.vk-panel-head\s*\{[^}]*var\(--vk-node-accent/)
    expect(css).toMatch(/\.vk-panel-head\s*\{[^}]*color:\s*var\(--vk-node-ink/)
  })

  it('系统行：os · arch · 虚拟化 整宽一行（缺项自动跳过）', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const sys = w.find('.vk-panel-sys')
    expect(sys.exists()).toBe(true)
    expect(sys.text()).toContain(frankfurt.os)
    expect(sys.text()).toContain(frankfurt.arch)
    expect(sys.text()).toContain(frankfurt.virtualization)

    const bare: Node = { ...frankfurt, arch: '', virtualization: '' }
    const w2 = mount(NodeCard, { props: { node: bare } })
    // 不留空的分隔点
    expect(w2.find('.vk-panel-sys').text()).toBe(frankfurt.os)
  })

  it('6 组「一行两列」指标行，行间有分隔线', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const rows = w.findAll('.vk-panel-row')
    expect(rows).toHaveLength(6)
    for (const r of rows)
      expect(r.findAll('.vk-cell')).toHaveLength(2)

    const css = readFileSync(resolve(ROOT, 'src/styles/v2/card.css'), 'utf8')
    expect(css).toMatch(/\.vk-panel-row\s*\+\s*\.vk-panel-row\s*\{[^}]*border-top/)
  })

  it('每个指标格都带一枚像素图标', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const cells = w.findAll('.vk-cell')
    expect(cells).toHaveLength(12)
    for (const c of cells)
      expect(c.find('img.pixel-icon, svg').exists(), '指标格缺图标').toBe(true)
  })

  it('Load 用橙色进度条，其余用绿（参考稿配色）', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const segs = w.findAll('.vk-seg')
    const colors = segs.map(s => (s.attributes('style') ?? '').match(/--vk-seg-color:\s*var\((--vk-[a-z-]+)\)/)?.[1])
    expect(colors).toEqual([
      '--vk-leaf', // CPU
      '--vk-leaf', // Memory
      '--vk-leaf', // Disk
      '--vk-honey', // Load ← 橙
      '--vk-leaf', // Latency
      '--vk-leaf', // Packet Loss
    ])
  })

  it('地区 → ISO 码 → 国旗素材（解析不出则不渲染国旗）', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const code = getRegionCode(frankfurt.region)
    expect(code).toMatch(/^[A-Z]{2}$/)
    const img = w.find('.vk-panel-flag img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(`/images/flags/${code}.svg`)

    const noRegion: Node = { ...frankfurt, region: '' }
    expect(mount(NodeCard, { props: { node: noRegion } }).find('.vk-panel-flag').exists()).toBe(false)
  })
})

describe('NodeCard 状态：颜色 + 文字双重区分（不只靠颜色）', () => {
  it('在线 → data-status=online 且带「在线」文案', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    expect(w.attributes('data-status')).toBe('online')
    expect(nodeViewStatus(frankfurt)).toBe('online')
    expect(w.find('.vk-card-status').text()).toBe('在线')
  })

  it('高占用 → alert 且文案「告警」', () => {
    const w = mount(NodeCard, { props: { node: heavy } })
    expect(w.attributes('data-status')).toBe('alert')
    expect(w.find('.vk-card-status').text()).toBe('告警')
  })

  it('离线（合成）→ offline 且文案「离线」', () => {
    const offline: Node = { ...frankfurt, online: false }
    const w = mount(NodeCard, { props: { node: offline } })
    expect(w.attributes('data-status')).toBe('offline')
    expect(w.find('.vk-card-status').text()).toBe('离线')
  })

  it('无状态节点 → unknown 且文案「未知」', () => {
    const unknown: Node = { ...frankfurt, hasStatus: false }
    const w = mount(NodeCard, { props: { node: unknown } })
    expect(w.attributes('data-status')).toBe('unknown')
    expect(w.find('.vk-card-status').text()).toBe('未知')
  })
})

describe('NodeCard 视觉契约：取色仅走母板令牌、像素风硬边', () => {
  const cardCss = readFileSync(resolve(ROOT, 'src/styles/v2/card.css'), 'utf8')

  it('card.css 无裸 hex（全部走 var(--vk-*)）', () => {
    expect(cardCss.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([])
  })

  it('像素风：小圆角 + 硬投影（不用 blur）', () => {
    expect(cardCss).toMatch(/--vk-panel-radius/)
    // 硬投影：位移 px + 0 blur（模糊量必须是 0）
    expect(cardCss).toMatch(/box-shadow:\s*\d+px \d+px 0 0/)
  })

  it('tokens.css 定义木牌面板令牌，且已无 accent 令牌', () => {
    const tokens = readFileSync(resolve(ROOT, 'src/styles/v2/tokens.css'), 'utf8')
    for (const t of ['--vk-panel-head-face', '--vk-panel-face', '--vk-panel-border', '--vk-panel-value', '--vk-seg-h'])
      expect(tokens).toContain(t)
    expect(tokens).not.toContain('--vk-card-accent')
    expect(tokens).not.toContain('--vk-card-ink')
  })

  it('卡片根节点带 uuid 锚点与语义类名（探针/e2e 依赖）', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    expect(w.classes()).toContain('vk-node-card')
    expect(w.attributes('data-node-id')).toBe(frankfurt.uuid)
  })
})

describe('每台一色（参考稿本身就是每台一色，配色取自参考稿实测）', () => {
  const tokens = readFileSync(resolve(ROOT, 'src/styles/v2/tokens.css'), 'utf8')

  function contrast(a: string, b: string): number {
    const lum = (h: string) => {
      const v = h.replace('#', '')
      const ch = [0, 2, 4].map(i => Number.parseInt(v.slice(i, i + 2), 16) / 255)
      const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
      return 0.2126 * f(ch[0]!) + 0.7152 * f(ch[1]!) + 0.0722 * f(ch[2]!)
    }
    const [la, lb] = [lum(a), lum(b)]
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
  }

  it('tokens.css 定义 6 组 accent/ink 成对令牌', () => {
    for (let i = 1; i <= 6; i++) {
      expect(tokens).toContain(`--vk-node-accent-${i}:`)
      expect(tokens).toContain(`--vk-node-ink-${i}:`)
    }
  })

  it('每组 accent 与其 ink 的对比度都 ≥4.5:1（WCAG 实算，标题栏整块上色）', () => {
    for (let i = 1; i <= 6; i++) {
      const a = tokens.match(new RegExp(`--vk-node-accent-${i}:\\s*(#[0-9a-fA-F]{6})`))![1]!
      const k = tokens.match(new RegExp(`--vk-node-ink-${i}:\\s*(#[0-9a-fA-F]{6})`))![1]!
      expect(contrast(a, k), `accent-${i} (${a}) 与 ink-${i} (${k}) 对比度不足`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('卡片根节点成对下发 --vk-node-accent 与 --vk-node-ink', () => {
    const w = mount(NodeCard, { props: { node: frankfurt, accentIndex: 2 } })
    const style = w.attributes('style') ?? ''
    expect(style).toContain('--vk-node-accent: var(--vk-node-accent-3)')
    expect(style).toContain('--vk-node-ink: var(--vk-node-ink-3)')
    expect(w.attributes('data-accent')).toBe('3')
  })

  it('同一台每次同色（不传 accentIndex 时按 uuid 稳定哈希）', () => {
    const a = mount(NodeCard, { props: { node: frankfurt } }).attributes('data-accent')
    const b = mount(NodeCard, { props: { node: frankfurt } }).attributes('data-accent')
    expect(a).toBe(b)
  })

  it('assignAccents：同批 ≤6 台两两不同色，且结果稳定、与传入顺序无关', () => {
    const uuids = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6']
    const m1 = assignAccents(uuids)
    expect(new Set(m1.values()).size).toBe(6)
    expect(assignAccents([...uuids].reverse())).toEqual(m1)
    expect(assignAccents([]).size).toBe(0)
    // 超过槽位数 → 回绕
    const many = assignAccents(Array.from({ length: 13 }, (_, i) => `n${i}`))
    expect(many.size).toBe(13)
    expect(Math.max(...many.values())).toBeLessThan(6)
  })
})
