import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('a11y: theme baseline', () => {
  it('uses semantic button elements instead of divs for controls', () => {
    const buttonFile = readFileSync('src/components/ui/button/index.ts', 'utf8')
    expect(buttonFile).toContain('button')
  })

  it('has visible focus styles in button variants', () => {
    const buttonFile = readFileSync('src/components/ui/button/index.ts', 'utf8')
    expect(buttonFile).toContain('focus-visible:')
  })

  it('icon-only controls expose aria-label', () => {
    const backTop = readFileSync('src/components/ui/back-top/BackTop.vue', 'utf8')
    expect(backTop).toContain('aria-label=')
  })
})
