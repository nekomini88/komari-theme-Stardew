import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, '..', '..', 'src', 'styles', 'v2', 'card.css'), 'utf8')

/**
 * 用户口径（2026-10-13）：「komari 按照每行 4 个服务器的宽度」→ 桌面 4 列。
 *
 * 连带约束（实测得出，必须一起守住）：
 *  - 卡片宽度随之从 ~383px 降到 ~283px
 *  - 名称若仍用 24px，108px 的可用宽度放不下 144px 的名字 → 会出现 "…"
 *    （参考站在 303px 卡上名称仅 14px，我们取 12px —— 像素字只能取 12 的整数倍）
 *  - 降到 3 列后卡片变宽，名称恢复大字
 */
describe('每行 4 台（用户 2026-10-13 口径）', () => {
  const grid = css.match(/\.vk-node-grid \{[\s\S]*?\}/)?.[0] ?? ''

  it('默认 4 列', () => {
    expect(grid, '未找到 .vk-node-grid 规则').not.toBe('')
    expect(grid.replace(/\s+/g, ' '), '桌面应为每行 4 台').toContain('repeat(4, minmax(0, 1fr))')
  })

  it('窄屏逐级降列：≤1200→3、≤900→2、≤600→1', () => {
    const blocks = [...css.matchAll(/@media \(max-width: (\d+)px\) \{[\s\S]*?\n\}/g)]
    const byWidth = new Map(blocks.map(m => [m[1], m[0]]))
    expect(byWidth.get('1200')?.replace(/\s+/g, ' '), '≤1200 应降为 3 列').toContain('repeat(3, minmax(0, 1fr))')
    expect(byWidth.get('900')?.replace(/\s+/g, ' '), '≤900 应降为 2 列').toContain('repeat(2, minmax(0, 1fr))')
    expect(byWidth.get('600')?.replace(/\s+/g, ' '), '≤600 应降为 1 列').toContain('minmax(0, 1fr)')
  })

  it('名称字号：4 列也是大字 24px（实测放得下），且用几何无衬线 ExtraBold', () => {
    const all = [...css.matchAll(/\.vk-panel-name \{[\s\S]*?\}/g)].map(m => m[0])
    const main = all.sort((a, b) => b.length - a.length)[0] ?? ''
    const flat = main.replace(/\s+/g, ' ')
    // 用户 2026-10-13：「服务器字体要大」。历史上此处写死 12px（理由：4 列可用宽仅 108px）。
    // 实测（probe_name_font.py，真实页面逐档量 scrollWidth vs clientWidth）：4 列名称盒已有 213px，
    // 12~24px 六档全部"放得下 5/6"，唯一截断的是天生超长的 Specials。故旧约束不成立，直接上 24px。
    expect(flat, '4 列下名称应为大字 24px（= --vk-fs-lg）').toContain('font-size: var(--vk-fs-lg)')
    expect(flat, '名称必须用几何无衬线字体').toContain('font-family: var(--vk-font-name)')
    expect(flat, '名称必须用真实 800 字重').toMatch(/font-weight:\s*800/)

    // 3 列不再需要单独覆盖字号（与 4 列同为大字）
    const m1200 = css.match(/@media \(max-width: 1200px\) \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(m1200.replace(/\s+/g, ' '), '≤1200 只降列数，不再覆盖字号').not.toContain('vk-panel-name')
  })
})
