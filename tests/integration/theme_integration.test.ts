import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('theme integration', () => {
  it('SHOULD have stardew option in Header.vue', () => {
    const header = readFileSync('src/components/Header.vue', 'utf-8')
    expect(header).toContain("value: 'stardew'")
    expect(header).toContain("label: '星露'")
  })

  it('MUST define stardew css variables', () => {
    const css = readFileSync('src/styles/main.css', 'utf-8')
    expect(css).toContain('[data-theme="stardew"]')
    expect(css).toContain('oklch(0.58 0.18 85)')
  })
})
