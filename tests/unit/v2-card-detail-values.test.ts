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
function mainRule(cssText: string, selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const all = [...cssText.matchAll(new RegExp(`${esc} \\{[\\s\\S]*?\\}`, 'g'))].map(m => m[0])
  return all.sort((a, b) => b.length - a.length)[0] ?? ''
}

const css = readFileSync(resolve(__dirname, '..', '..', 'src', 'styles', 'v2', 'card.css'), 'utf8')

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

  it('指标格行高只由内容决定（缺明细行的格子不得被拉伸）', () => {
    // 用户 2026-10-13：「Disk 和 load 不在一个水平线看起来不舒服」。
    // 12 格中只有 CPU/内存/硬盘有明细行 → 缺明细的格子会空出 16.19px，
    // 被 align-content 默认 stretch 均摊到三行（每行 +5.4px），行内又 center 居中
    // → 内容错位 2.695px、进度条错位 8.08px（实测）。必须 start。
    const block = mainRule(css, '.vk-cell').replace(/\s+/g, ' ')
    expect(block, '未找到 .vk-cell 规则').not.toBe('')
    expect(block, '行高不得拉伸，否则同排两格会不在一个水平线')
      .toContain('align-content: start')
  })

  it('明细用独立样式类，且进度条仍在（百分比与容量并存，不是替换）', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    expect(w.findAll('.vk-cell-detail').length).toBe(3)
    // 百分比仍在
    expect(text(w, 'cpu')).toContain('%')
    expect(text(w, 'mem')).toContain('%')
    expect(text(w, 'disk')).toContain('%')
    // 进度条也仍在（CPU/内存/硬盘/负载为比例条；延迟/丢包已按参考站改成 20 格样本条）
    expect(w.findAll('.vk-seg').length).toBeGreaterThanOrEqual(4)
    expect(w.findAll('.vk-samples').length).toBe(2)
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
  /** 取某选择器的主规则块：同一选择器可能在 @media 里也有覆盖，
 *  用「最长匹配」当作主规则（主规则声明最多）。避免脆弱的首个匹配。 */

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
    // 国旗/状态点定位由「横幅右端绝对定位」实现（用户 2026-10-13 口径：国旗放在右边），
    // 见下一个用例对 .vk-panel-meta 的断言
  })

  it('横幅用「1fr | auto | 1fr」三列网格，名称占中列 —— 两翼等宽才能让名称自身居中', () => {
    const headBlock = mainRule(css, '.vk-panel-head')
    expect(headBlock, '未找到 .vk-panel-head 规则').not.toBe('')
    // 必须同时断言「布局模式」：只断言 track 列表会漏掉「有 grid-template-columns 却没有 display:grid」
    // 这种错（实测发生过 —— 规则里 grid-template-columns 在、display:grid 被删，整条网格静默失效，
    // 名称靠 text-align 蒙对居中，国旗则掉到第二行左侧）
    expect(headBlock.replace(/\s+/g, ' '), '.vk-panel-head 必须是 grid 容器，否则 track 列表无效')
      .toContain('display: grid')
    expect(headBlock.replace(/\s+/g, ' '), '两翼必须等宽，否则名称会被国旗宽度推偏')
      .toMatch(/grid-template-columns: 1fr minmax\((0|auto|max-content), (?:calc\(100% - \d+px\)|\d+%)\) 1fr/)
    // 中列下限用 auto（收缩到名称内容宽）—— 徽标才能贴着名称右缘（用户：「太割裂了」）。
    // 但**上限必须是百分比**：若上限也写成 auto(=max-content)，长名会撑破容器把两翼压成 0，
    // 名称就偏左了（实测长名偏 10px）。百分比上限 ⇒ 长名省略号截断且保持居中。
    expect(headBlock.replace(/\s+/g, ' '), '中列上限须为百分比，长名才截断而不是挤掉两翼')
      .toMatch(/minmax\((0|auto|max-content), (?:calc\(100% - \d+px\)|\d+%)\)/)
    // 栅格定位由名称外壳承担（名称本身不再是栅格项 —— 徽标要相对外壳定位）
    const wrapBlock = mainRule(css, '.vk-name-wrap')
    expect(wrapBlock).toContain('grid-column: 2')
    expect(wrapBlock).toContain('justify-self: center')
  })

  it('OS 图标/国旗/状态点同组，**锚在名称右缘**（用户 2026-10-13：割裂 → 收紧）', () => {
    const w = mount(NodeCard, { props: { node: frankfurt } })
    const meta = w.find('.vk-panel-meta')
    expect(meta.exists()).toBe(true)
    expect(meta.find('.vk-panel-flag').exists()).toBe(true)
    expect(meta.find('.vk-panel-dot').exists()).toBe(true)

    const metaBlock = mainRule(css, '.vk-panel-meta')
    expect(metaBlock, '未找到 .vk-panel-meta 规则').not.toBe('')
    const flat = metaBlock.replace(/\s+/g, ' ')
    // 口径演进全过程（三次实测）：
    //  a. 徽标钉在横幅右缘 → 各卡间隙 10.5~40.8px 不等，短名字的卡上像挂件（用户：「太割裂了」）
    //  b. 改栅格第三列 + 中列 minmax(auto|max-content, 48%) → 无效：中列恒为上限 92.63px
    //  c. 徽标 left:100% 想相对名称 → 无效：徽标是名称的兄弟节点，offsetParent 是横幅
    // 最终：徽标相对 **.vk-name-wrap 收缩壳** 绝对定位 ⇒ 与栅格轨道无关，恒定 8px
    expect(flat, '徽标要相对名称外壳定位').toContain('position: absolute')
    expect(flat, 'left:100% = 紧贴名称右缘').toContain('left: 100%')

    const wrap = mainRule(css, '.vk-name-wrap').replace(/\s+/g, ' ')
    expect(wrap, '缺 .vk-name-wrap：徽标会相对横幅定位（实测溢出 6/6）').not.toBe('')
    expect(wrap, '外壳必须是定位祖先').toContain('position: relative')
    expect(wrap, '外壳必须收缩到名称宽度（inline-block）').toContain('display: inline-block')
    expect(wrap, '外壳在栅格里居中 ⇒ 名称仍精确居中').toContain('justify-self: center')

    // 名称**不得**再被额外扣净空：曾写 max-width: calc(100% - 96px) 想把名字让开国旗，
    // 实测把名称盒压到 85.4px（内容要 95~144px）→ 6 个名字全被截断成 "…"。
    // 净空应由中列上限（minmax(0,62%)）保证，名称自身用满 100%。
    const nameBlock = mainRule(css, '.vk-panel-name')
    // 先剥注释再断言：注释里会写到历史写法（max-width: calc(...)），
    // 直接扫原文会被自己的注释打红（这个坑已踩三次，视为默认动作而非例外）
    const nb = nameBlock.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
    expect(nb, '名称不得再用 calc(...) 扣净空，否则会截断正常长度的名字')
      .not.toMatch(/max-width:\s*calc\(/)
    expect(nb, '名称自身应用满所在列').toContain('max-width: 100%')
  })
})

describe('进度条与角饰让位（用户 2026-10-13 口径）', () => {
  const css = readFileSync(resolve(__dirname, '..', '..', 'src', 'styles', 'v2', 'card.css'), 'utf8')

  it('进度条是「连续块」：允许分块纹理，但细缝不得透明（不得露出底色 = 不得"空"）', () => {
    const raw = css.match(/\.vk-seg-fill \{[\s\S]*?\}/)?.[0] ?? ''
    expect(raw, '未找到 .vk-seg-fill 规则').not.toBe('')
    // 先剥注释再断言：注释里会写到历史做法（transparent 缝、整条实心），
    // 直接扫原文会被注释里的字面量打红（此坑已踩三次，列为默认动作）
    const fill = raw.replace(/\/\*[\s\S]*?\*\//g, '')
    // 只审 background 声明：box-shadow 里本来就有 transparent（是阴影，不是缝），别误伤
    const bg = fill.match(/background:\s*([\s\S]*?);/)?.[1].replace(/\s+/g, ' ') ?? ''
    expect(bg, '未取到 .vk-seg-fill 的 background').not.toBe('')
    // 用户 2026-10-13 口径：像 komari.vickypig.com 那样的一排小块（连续块）
    expect(bg, '应按参考站做成一排小块').toContain('repeating-linear-gradient')
    expect(bg, '细缝必须同色系压暗，不能用 transparent（否则条上会露出底色 = 出现"空"）')
      .not.toContain('transparent')
    expect(bg, '块色仍应取 --vk-seg-color').toContain('var(--vk-seg-color')
    // 块距 8px（7px 块 + 1px 缝）：条宽 168.3px ⇒ 约 21 格，与参考站 20 格同比例
    expect(bg).toMatch(/0 7px,[\s\S]*?7px 8px/)
  })

  it('最后一行右格必须给右下角向日葵留净空（否则压住 Uptime 数值）', () => {
    expect(css.replace(/\s+/g, ' '), '最后一行右格需要 padding-right 让开向日葵')
      .toMatch(/\.vk-panel-row:last-child > \.vk-cell:last-child \{ padding-right: \d+px; \}/)
  })
})
