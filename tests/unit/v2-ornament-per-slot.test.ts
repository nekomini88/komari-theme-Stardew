import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..')
const css = readFileSync(resolve(ROOT, 'src', 'styles', 'v2', 'card.css'), 'utf8')
const tokens = readFileSync(resolve(ROOT, 'src', 'styles', 'v2', 'tokens.css'), 'utf8')
const card = readFileSync(resolve(ROOT, 'src', 'v2', 'components', 'NodeCard.vue'), 'utf8')

/**
 * 用户口径（2026-10-13 第 5 条）：「每个服务器装饰物我希望做成的不同的物品」
 * → 6 个配色槽各配一个不同的角饰（向日葵/浇水壶/草莓/蘑菇/南瓜/信箱），
 *    素材由 ListenHub 出图（品红底抠透明）、按槽位下发。
 */
describe('每台一个不同的角饰（用户 2026-10-13 口径）', () => {
  it('6 个槽都有独立令牌，且指向 6 个不同的素材文件', () => {
    const urls: string[] = []
    for (let i = 1; i <= 6; i++) {
      const m = tokens.match(new RegExp(`--vk-orn-${i}:\\s*url\\(([^)]+)\\);`))
      expect(m, `缺少 --vk-orn-${i} 令牌`).not.toBeNull()
      urls.push(m![1])
    }
    expect(new Set(urls).size, '6 个槽必须指向不同素材，否则就不是「每台不同」').toBe(6)
    for (const u of urls)
      expect(u).toMatch(/^\/images\/v2-orn\/orn-[a-z]+\.png$/)
  })

  it('角饰按配色槽下发：--vk-orn 必须绑定到 --vk-orn-<槽+1>', () => {
    expect(card.replace(/\s+/g, ' '), '未按槽下发角饰')
      .toContain('\'--vk-orn\': `var(--vk-orn-${accentSlot + 1})`')
  })

  it('角饰用 contain 保比例 + pixelated（原先写 100% 100% 会把形状拉变形）', () => {
    const block = css.match(/\.vk-panel::after \{[\s\S]*?\}/)?.[0] ?? ''
    expect(block, '未找到 .vk-panel::after 规则').not.toBe('')
    const b = block.replace(/\s+/g, ' ')
    expect(b, '素材长宽比各不相同，必须 contain').toContain('background-size: contain')
    expect(b, '像素素材禁止平滑缩放').toContain('image-rendering: pixelated')
    expect(b).toContain('background-image: var(--vk-orn')
  })
})

/**
 * 用户口径（2026-10-13 第 4 条）：太阳换成卡通可爱风格。
 * 场景是整幅插画（太阳烘在 day.png 里），做法是「填掉原太阳 + 贴卡通太阳」，
 * 必须保证：尺寸仍 16:9、仍是索引色、体积仍在包体预算内。
 */
describe('场景 day.png：卡通太阳替换后的硬约束', () => {
  const png = readFileSync(resolve(ROOT, 'public', 'images', 'v2-scene', 'full', 'day.png'))

  it('体积仍在 400KB 预算内', () => {
    expect(png.length).toBeLessThanOrEqual(400 * 1024)
  })

  it('仍是索引色 PNG（色彩类型 3）', () => {
    // PNG IHDR: 8 字节签名 + 4 长度 + 4 类型 + 宽(4) 高(4) 位深(1) 色彩类型(1)
    expect(png[25], 'day.png 必须是索引色（量化后不要 convert 回 RGB）').toBe(3)
  })

  it('尺寸仍是 1920x1072（16:9 播放窗口）', () => {
    const w = png.readUInt32BE(16)
    const h = png.readUInt32BE(20)
    expect([w, h]).toEqual([1920, 1072])
  })
})
