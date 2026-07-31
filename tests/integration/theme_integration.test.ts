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
