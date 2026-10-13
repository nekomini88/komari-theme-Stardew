import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import NodeCard from '@/v2/components/NodeCard.vue'
import type { Node } from '@/v2/data/types'

/**
 * 用户口径（2026-10-13）：参考 komari.vickypig.com —— 卡片要有**操作系统图标**，
 * 且放在**国旗旁边**。
 *
 * 参考站实测：OS 图标 /images/logo/os-*.svg，16x16（size-4）；
 * 所在行 `flex gap-2 items-center` 宽 44px = OS 16 + 缝 8 + 国旗 20 ⇒ **OS 在国旗左侧**。
 */

const css = readFileSync(resolve(__dirname, '..', '..', 'src', 'styles', 'v2', 'card.css'), 'utf8')

function mkNode(over: Partial<Node> = {}): Node {
  return {
    uuid: 'u1', name: '测试节点', group: '', region: '🇯🇵', os: 'Ubuntu 22.04.5 LTS',
    arch: 'amd64', online: true, hidden: false, tags: [],
    cpu: 10, ram: 20, disk: 30, load: 0.5,
    ...over,
  } as unknown as Node
}

describe('操作系统图标（用户 2026-10-13 口径：参考 komari.vickypig.com）', () => {
  it('有 os 时渲染图标，且素材按系统匹配', () => {
    const w = mount(NodeCard, { props: { node: mkNode() } })
    const icon = w.find('.vk-panel-osicon')
    expect(icon.exists(), '缺少操作系统图标').toBe(true)
    const img = icon.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src'), 'Ubuntu 应匹配到 os-ubuntu 素材').toContain('os-ubuntu')
  })

  it('图标在国旗旁边，且按参考站在国旗左侧', () => {
    const w = mount(NodeCard, { props: { node: mkNode() } })
    const meta = w.find('.vk-panel-meta')
    expect(meta.exists(), '未找到横幅右侧集群').toBe(true)
    expect(meta.find('.vk-panel-osicon').exists(), '图标必须与国旗同组').toBe(true)
    expect(meta.find('.vk-panel-flag').exists()).toBe(true)
    // DOM 顺序 = 渲染顺序：OS 图标应在国旗之前
    const html = meta.html()
    expect(html.indexOf('vk-panel-osicon'), 'OS 图标应在国旗左侧（参考站顺序）')
      .toBeLessThan(html.indexOf('vk-panel-flag'))
  })

  it('16px 盒子（16 的整数倍 = 像素纪律），与参考站 size-4 一致', () => {
    const block = css.match(/\.vk-panel-osicon \{[\s\S]*?\}/)?.[0] ?? ''
    expect(block, '未找到 .vk-panel-osicon 规则').not.toBe('')
    const imgBlock = css.match(/\.vk-panel-osicon img \{[\s\S]*?\}/)?.[0] ?? ''
    expect(imgBlock, '未找到 .vk-panel-osicon img 规则').not.toBe('')
    expect(imgBlock.replace(/\s+/g, ' '), 'OS 图标必须是 16px').toContain('width: 16px')
    expect(imgBlock.replace(/\s+/g, ' ')).toContain('height: 16px')
  })

  it('os 为空时不渲染图标（不给"未知系统"默认图，避免误导）', () => {
    const w = mount(NodeCard, { props: { node: mkNode({ os: '' }) } })
    expect(w.find('.vk-panel-osicon').exists(), 'os 为空不该出现图标').toBe(false)
  })

  it('识别不了的系统走兜底素材（不破图）', () => {
    const w = mount(NodeCard, { props: { node: mkNode({ os: 'TotallyUnknownOS 9' }) } })
    const icon = w.find('.vk-panel-osicon')
    expect(icon.exists(), '非空 os 仍应给图标（兜底）').toBe(true)
    // 兜底图是 /images/logo/linux.svg（defaultOSConfig）—— 只要求是包内合法素材路径
    expect(icon.find('img').attributes('src')).toMatch(/^\/images\/logo\/.+\.(svg|png|webp|ico)$/)
  })

  it('名称中列上限已为右侧集群让位（集群多了 16px 图标 + 6px 缝）', () => {
    const head = css.match(/\.vk-panel-head \{[\s\S]*?\}/)?.[0] ?? ''
    // 集群：OS 16 + 缝 6 + 旗 22 + 缝 6 + 圆点 12 = 62px，右边距 14 → 名称右缘须 ≤ ~306px
    expect(head.replace(/\s+/g, ' '), '右侧集群变宽后必须收窄名称上限，否则长名会压到图标')
      .toContain('grid-template-columns: 1fr minmax(0, 56%) 1fr')
  })
})
