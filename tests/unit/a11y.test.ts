import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// 2026-10-13 迁移：原断言读 v1 的 ui/button 与 ui/back-top（已随 v1 层删除）。
// 不变量不变 —— 控件必须是语义化 button、且图标按钮要有 aria-label；改指活组件。
// （原「button variants 含 focus-visible」那条随 ui/button 一起退役：活顶栏按钮不自带样式变体。）
describe('a11y: theme baseline', () => {
  it('uses semantic button elements instead of divs for controls', () => {
    const topbar = readFileSync('src/v2/components/TopBar.vue', 'utf8')
    expect(topbar).toContain('<button')
    expect(topbar).toContain('type="button"')
  })

  it('icon-only controls expose aria-label', () => {
    const backTop = readFileSync('src/v2/components/BackToTop.vue', 'utf8')
    expect(backTop).toContain('aria-label=')
  })
})
