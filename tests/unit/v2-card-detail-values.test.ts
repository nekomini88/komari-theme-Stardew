import type { Node, RawClient, RawStatus } from '@/v2/data/types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import NodeCard from '@/v2/components/NodeCard.vue'
import { buildNodes } from '@/v2/data/nodeModel'
import { formatBytes, formatLoad } from '@/v2/data/metrics'

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'fixtures', 'clients.sample.json'), 'utf8'),
) as { nodes: Record<string, RawClient>, statuses: Record<string, RawStatus> }

const nodes: Node[] = buildNodes(fixture.nodes, fixture.statuses)
const frankfurt = nodes.find(n => n.name === '法兰克福free')!

function text(wrapper: ReturnType<typeof mount>, field: string): string {
  return wrapper.find(`[data-field="${field}"]`).text()
}

/**
 * 用户口径（2026-10-13）：「cpu 和 disk 只有百分比 没有实际容量 没有关键信息」
 * 同站其它主题（见用户截图）在进度条下方给出实际值：
 *   CPU    → 1/5/15 分钟负载 + 核数，形如 0.00, 0.00, 0.00 (1c)
 *   Memory → 已用 / 总量，形如 245.7 MB / 932.3 MB
 *   Disk   → 已用 / 总量
 * 这些字段数据层一直就有（ram/ramTotal/disk/diskTotal/load/load5/load15/cpuCores），
 * 只是没渲染出来 —— 本组测试锁住渲染，防止回归成「只有百分比」。
 */
describe('NodeCard 实际容量明细：CPU/Memory/Disk 不能只有百分比', () => {
  it('CPU 明细 = 1/5/15 分钟负载 + 核数', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const expected = `${[frankfurt.load, frankfurt.load5, frankfurt.load15].map(v => formatLoad(v)).join(', ')}`
    expect(text(w, 'cpu-detail')).toBe(`${expected} (${frankfurt.cpuCores}c)`)
  })

  it('Memory 明细 = 已用 / 总量（两者都由 formatBytes 输出）', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    expect(text(w, 'mem-detail')).toBe(`${formatBytes(frankfurt.ram)} / ${formatBytes(frankfurt.ramTotal)}`)
  })

  it('Disk 明细 = 已用 / 总量', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    expect(text(w, 'disk-detail')).toBe(`${formatBytes(frankfurt.disk)} / ${formatBytes(frankfurt.diskTotal)}`)
  })

  it('总量缺失时退化为只显示已用，不留 " / " 尾巴', () => {
    const noTotal: Node = { ...frankfurt, ramTotal: 0, diskTotal: 0 }
    const w = mount(NodeCard, { props: { node: noTotal } })
    expect(text(w, 'mem-detail')).toBe(formatBytes(noTotal.ram))
    expect(text(w, 'disk-detail')).toBe(formatBytes(noTotal.disk))
    expect(text(w, 'mem-detail')).not.toContain('/')
  })

  it('核数缺失时不输出 "(0c)" 这种噪声', () => {
    const noCores: Node = { ...frankfurt, cpuCores: 0 }
    const w = mount(NodeCard, { props: { node: noCores } })
    expect(text(w, 'cpu-detail')).not.toContain('c)')
  })

  it('明细用独立样式类，且进度条仍在（百分比与容量并存，不是替换）', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    expect(w.findAll('.vk-cell-detail').length).toBe(3)
    // 百分比仍在
    expect(text(w, 'cpu')).toContain('%')
    expect(text(w, 'mem')).toContain('%')
    expect(text(w, 'disk')).toContain('%')
    // 进度条也仍在
    expect(w.findAll('.vk-seg').length).toBeGreaterThanOrEqual(6)
  })
})

/**
 * 用户口径：「服务器名称 没有居中居上 看起来不舒服」
 * 实测几何上是居中的（偏 0.0px），问题是**视觉**失衡：
 *   - .vk-panel 有 padding:16px → 横幅被压低 17px，不贴卡片顶端（参考稿横幅贴顶满宽）
 *   - 横幅左端挂了 32px 图标，而参考稿横幅里没有图标，国旗是**紧跟名称右侧**的
 * 因此：横幅贴顶由 CSS 保证（下面断言 padding:0），结构上横幅内不得再出现图标。
 */
describe('NodeCard 标题栏：贴顶 + 名称与国旗同组（复刻参考稿）', () => {
  const css = readFileSync(resolve(__dirname, '..', '..', 'src', 'styles', 'v2', 'card.css'), 'utf8')

  it('.vk-panel 不得有内边距（否则横幅被压低，名称"没有居上"）', () => {
    const block = css.match(/\.vk-panel \{[\s\S]*?\}/)?.[0] ?? ''
    expect(block, '未找到 .vk-panel 规则').not.toBe('')
    expect(block, '.vk-panel 若有 padding，横幅就不贴顶').toMatch(/padding:\s*0\b/)
  })

  it('横幅里不再挂图标（参考稿横幅内只有名称 + 国旗）', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    expect(w.find('.vk-panel-head-icon').exists()).toBe(false)
    expect(w.find('.vk-panel-head .vk-card-head-icon').exists()).toBe(false)
  })

  it('名称与国旗、状态点都在同一横幅内（不再靠绝对定位钉到两端）', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const head = w.find('.vk-panel-head')
    expect(head.find('.vk-panel-name').exists()).toBe(true)
    expect(head.find('.vk-panel-dot').exists()).toBe(true)
    // 国旗/状态点不得再用绝对定位（绝对定位 + 居中文本 = 视觉失衡）
    const flagBlock = css.match(/\.vk-panel-flag \{[\s\S]*?\}/)?.[0] ?? ''
    const dotBlock = css.match(/\.vk-panel-dot \{[\s\S]*?\}/)?.[0] ?? ''
    expect(flagBlock).not.toContain('position: absolute')
    expect(dotBlock).not.toContain('position: absolute')
  })

  it('横幅用「1fr | auto | 1fr」三列网格，名称占中列 —— 两翼等宽才能让名称自身居中', () => {
    const headBlock = css.match(/\.vk-panel-head \{[\s\S]*?\}/)?.[0] ?? ''
    expect(headBlock, '未找到 .vk-panel-head 规则').not.toBe('')
    expect(headBlock.replace(/\s+/g, ' '), '两翼必须等宽，否则名称会被国旗宽度推偏')
      .toContain('grid-template-columns: 1fr minmax(0, 62%) 1fr')
    // 中列上限必须是百分比：若上限是 auto(=max-content)，长名会撑破容器把两翼压成 0，
    // 名称就偏左了（实测长名偏 10px）。百分比上限 + 0 下限 ⇒ 长名省略号截断且保持居中。
    expect(headBlock.replace(/\s+/g, ' '), '中列上限须为百分比，长名才截断而不是挤掉两翼')
      .toContain('minmax(0, 62%)')
    const nameBlock = css.match(/\.vk-panel-name \{[\s\S]*?\}/)?.[0] ?? ''
    expect(nameBlock).toContain('grid-column: 2')
    expect(nameBlock).toContain('justify-self: center')
  })

  it('国旗与状态点同组，容器左对齐紧贴名称右侧', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const meta = w.find('.vk-panel-meta')
    expect(meta.exists()).toBe(true)
    expect(meta.find('.vk-panel-flag').exists()).toBe(true)
    expect(meta.find('.vk-panel-dot').exists()).toBe(true)
    const metaBlock = css.match(/\.vk-panel-meta \{[\s\S]*?\}/)?.[0] ?? ''
    expect(metaBlock).toContain('grid-column: 3')
    expect(metaBlock).toContain('justify-self: start')
  })
}
)
