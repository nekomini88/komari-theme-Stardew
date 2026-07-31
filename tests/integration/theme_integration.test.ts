import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('theme integration', () => {
  it('SHOULD expose stardew visual-style option in Header.vue', () => {
    const header = readFileSync('src/components/Header.vue', 'utf-8')
    expect(header).toContain("value: 'stardew'")
    expect(header).toContain("label: '星露谷风格'")
    expect(header).toContain('selectVisualStyle')
  })

  it('MUST define stardew visual-style css tokens', () => {
    const css = readFileSync('src/styles/main.css', 'utf-8')
    expect(css).toContain('[data-theme="stardew"]')
    expect(css).toContain('--visual-radius-panel')
    expect(css).toContain('--visual-panel-shadow')
    expect(css).toContain('Jersey 10')
  })
})

describe('matte pixel surfaces under stardew theme', () => {
  it('MUST disable glass blur and enforce matte surfaces in main.css', () => {
    const css = readFileSync('src/styles/main.css', 'utf8')
    expect(css).toContain("matte-pixel.css")
    expect(css).toContain("backdrop-filter: none !important")
    // pixel shadow signature is enforced in matte-pixel.css and visual-card-patch.css
    const matte = readFileSync('src/styles/matte-pixel.css', 'utf8')
    expect(matte).toContain("[data-theme=\"stardew\"]")
    expect(matte).toContain("box-shadow:")
    expect(matte).toContain("var(--border-strong")
  })

  it('MUST use dotted matte borders and pixel shadows in matte-pixel.css', () => {
    const matte = readFileSync('src/styles/matte-pixel.css', 'utf8')
    expect(matte).toContain('[data-theme="stardew"]')
    // dotted is expressed either as shorthand or border-style
    const dotted = ['border-style: dotted', 'border: 2px dotted'].some(t => matte.includes(t))
    expect(dotted).toBe(true)
    // pixel shadow signature
    expect(matte).toContain('4px 4px 0 0 var(--border-strong')
  })
})
