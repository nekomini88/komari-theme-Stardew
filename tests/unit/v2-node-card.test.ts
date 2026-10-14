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
import { getRegionCode } from '@/utils/region/regionHelper'

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

  it('比例进度条 = 4 条（CPU/内存/硬盘/负载），宽度 = percentValue（0..100）', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const fills = w.findAll('.vk-seg-fill')
    // 延迟/丢包**不再是**比例条：用户 2026-10-13「按照参考站来」→ 改成 20 格真实样本条
    expect(fills).toHaveLength(4)

    const widthOf = (i: number) => fills[i]!.attributes('style') ?? ''
    expect(widthOf(0)).toContain(`${percentValue(frankfurt.cpu, 100)}%`)
    expect(widthOf(1)).toContain(`${percentValue(frankfurt.ram, frankfurt.ramTotal)}%`)
    expect(widthOf(2)).toContain(`${percentValue(frankfurt.disk, frankfurt.diskTotal)}%`)
    expect(widthOf(3)).toContain(`${percentValue(frankfurt.load, frankfurt.cpuCores)}%`)
  })

  it('延迟/丢包 = 两排 20 格样本条（对齐参考站 komari.vickypig.com）', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const grids = w.findAll('.vk-samples')
    expect(grids, '延迟与丢包各一条样本条').toHaveLength(2)
    for (const g of grids)
      expect(g.findAll('.vk-sample'), '参考站是 20 格').toHaveLength(20)
    // 每格必须带自己的等级与 tooltip（参考站每格也有独立 tooltip）
    for (const b of w.findAll('.vk-sample')) {
      expect(b.attributes('data-level'), '每格必须有等级').toMatch(/^(ok|warn|crit|none)$/)
      expect(b.attributes('title'), '每格必须有 tooltip').toBeTruthy()
    }
  })
})

describe('NodeCard 结构：木牌面板（复刻参考稿）', () => {
  it('标题栏：名称唯一 + 状态圆点 + 每台一色（名称那一行铺满整卡宽度）', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const heads = w.findAll('.vk-card-head')
    expect(heads).toHaveLength(1)
    expect(w.findAll('.vk-card-name')).toHaveLength(1)
    expect(w.find('.vk-card-name').text()).toBe('法兰克福free')
    expect(w.find('.vk-panel-dot').exists()).toBe(true)
    // 标题栏的叶藤造型与配色由**参考稿美术底板**提供（每台一色 = 6 张底板变体），
    // CSS 不再手搓叶边；文字色仍取 accent 配对的 ink
    const css = readFileSync(resolve(ROOT, 'src/styles/v2/components/card.css'), 'utf8')
    // 颜色落在**名称那一行**且铺满整卡宽度（用户 2026-10-13 目标图口径）。
    // 注意：不能只断言颜色存在 —— 必须先落到 .vk-panel-head 上，否则会退回"只有顶部一条丝带"
    expect(css, '名称那一行必须铺色槽色').toMatch(/\.vk-panel-head\s*\{[^}]*background-color:\s*var\(--vk-node-bg/)
    expect(css, '卡片主体必须仍是奶白纸（不能整卡染色）').toMatch(/\.vk-panel\s*\{[^}]*background-color:\s*var\(--vk-panel-paper\)/)
    expect(css).toMatch(/\.vk-panel-head\s*\{[^}]*color:\s*var\(--vk-node-ink/)
    // 配色改由「调色板」控件决定 → 下发的是解析后的实际色值，不再是 var(--vk-node-bg-N)
    expect(w.attributes('style'), '必须下发解析后的色槽底色').toMatch(/--vk-node-bg: #[0-9a-f]{6}/)
    expect(w.attributes('style'), '必须下发解析后的文字色').toMatch(/--vk-node-ink: #[0-9a-f]{6}/)
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

    const css = readFileSync(resolve(ROOT, 'src/styles/v2/components/card.css'), 'utf8')
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
      '--vk-ref-leaf', // CPU
      '--vk-ref-leaf', // Memory
      '--vk-ref-leaf', // Disk
      '--vk-honey', // Load ← 橙
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
  const cardCss = readFileSync(resolve(ROOT, 'src/styles/v2/components/card.css'), 'utf8')

  it('card.css 无裸 hex（全部走 var(--vk-*)）', () => {
    expect(cardCss.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([])
  })

  it('像素风：小圆角 + 硬投影（不用 blur）', () => {
    expect(cardCss).toMatch(/--vk-panel-radius/)
    // 硬投影：位移 px + 0 blur（模糊量必须是 0）
    expect(cardCss).toMatch(/box-shadow:\s*\d+px \d+px 0 0/)
  })

  it('tokens.css 定义木牌面板令牌，且已无 accent 令牌', () => {
    const tokens = readFileSync(resolve(ROOT, 'src/styles/v2/tokens/tokens.css'), 'utf8')
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
  const tokens = readFileSync(resolve(ROOT, 'src/styles/v2/tokens/tokens.css'), 'utf8')

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

  it('tokens.css 定义 6 组 ink/shadow 成对令牌（横幅配色由美术底板提供，已无 accent 令牌）', () => {
    for (let i = 1; i <= 6; i++) {
      expect(tokens).toContain(`--vk-node-ink-${i}:`)
      expect(tokens).toContain(`--vk-node-shadow-${i}:`)
    }
    expect(tokens).not.toContain('--vk-node-accent-')
  })

  // 对比度审核已改为对**美术底板横幅实测色**校验，见 v2-pixel-invariants.test.ts
  // （原先拿 accent 十六进制值算 —— 基准错误，正是 3 台字色压不住横幅的原因）

  it('卡片根节点成对下发 --vk-node-bg / --vk-node-ink / --vk-node-shadow', () => {
    const w = mount(NodeCard, { props: { node: frankfurt, accentIndex: 2 } })
    const style = w.attributes('style') ?? ''
    expect(style, '必须下发解析后的文字色').toMatch(/--vk-node-ink: #[0-9a-f]{6}/)
    expect(style, '描边同样来自调色板').toMatch(/--vk-node-shadow: #[0-9a-f]{6}/)
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

  it('Inbound 不得再用 globe（蓝色球体）—— 用户口径：去掉这个小球', () => {
    // 用户 2026-10-13：「去除所有的这个小球, 这个原来的pdf 是代表服务器状态的.」
    // 实测：全卡只有 Inbound 这行的像素图标含蓝色（globe 是蓝色地球，512/4096 蓝色像素）。
    const src = readFileSync(resolve(__dirname, '..', '..', 'src', 'v2', 'components', 'NodeCard.vue'), 'utf8')
    const row = src.slice(src.indexOf('<!-- Outbound / Inbound -->'))
    const block = row.slice(0, row.indexOf('<!-- Latency / Packet Loss -->'))
    expect(block, 'Inbound 行不得再出现 globe 图标（蓝色球体）').not.toMatch(/name="globe"/)
    expect(block, 'Inbound 应使用 traffic-down').toMatch(/name="traffic-down"/)
    expect(block, 'Outbound 应使用 traffic-up').toMatch(/name="traffic-up"/)
  })
})
