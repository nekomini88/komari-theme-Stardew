import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 用户 2026-10-13：「服务器上那行的装饰物全部删除」。
 * 此文件原先断言「6 个槽各有独立角饰素材」——装饰物已整体移除，
 * 故改为**反向断言**：角饰不得再出现在代码里（防止将来被无意加回）。
 */
const read = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8')

describe('卡片装饰物已按用户要求全部删除', () => {
  const tokens = read('src/styles/v2/tokens.css')
  const css = read('src/styles/v2/card.css')
  const card = read('src/v2/components/NodeCard.vue')

  it('不得再有任何 --vk-orn-N 令牌', () => {
    expect(tokens, '角饰令牌应已删除').not.toMatch(/--vk-orn-\d:/)
  })

  it('CSS 里不得再挂角饰（伪元素 ::after 或 --vk-orn 引用）', () => {
    expect(css, '角饰规则应已删除').not.toMatch(/--vk-orn|orn-sunflower/)
  })

  it('组件不得再下发角饰 --vk-orn（名牌贴图 --vk-panel-art 是名称行的装饰，保留）', () => {
    expect(card, '组件不应再下发角饰').not.toContain('--vk-orn')
    expect(card, '名称那一行的名牌贴图应保留').toContain("'--vk-panel-art'")
  })

  it('整卡底色改为按色槽下发 --vk-node-bg', () => {
    expect(card).toContain("'--vk-node-bg': `var(--vk-node-bg-${accentSlot + 1})`")
    for (let i = 1; i <= 6; i++) {
      expect(tokens, `缺少 --vk-node-bg-${i}`).toMatch(new RegExp(`--vk-node-bg-${i}:\\s*#[0-9a-f]{6};`))
    }
  })

  it('六个底色互不相同（每台一色保持不变）', () => {
    const found = [...tokens.matchAll(/--vk-node-bg-(\d):\s*(#[0-9a-f]{6});/g)].map(m => m[2])
    expect(found.length).toBe(6)
    expect(new Set(found).size, '六个槽的底色必须各不相同').toBe(6)
  })
})
