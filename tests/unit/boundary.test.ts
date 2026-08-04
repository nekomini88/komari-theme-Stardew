import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('boundary: spec.yaml and sources', () => {
  it('spec.yaml required fields are non-empty after colon', () => {
    const yaml = readFileSync('spec.yaml', 'utf8')
    expect(yaml).not.toMatch(/^name:\s*$/m)
    expect(yaml).not.toMatch(/^version:\s*$/m)
    expect(yaml).not.toMatch(/^project_type:\s*$/m)
  })

  it('komari-theme.json must have non-empty name and short', () => {
    const json = JSON.parse(readFileSync('komari-theme.json', 'utf8'))
    expect(typeof json.name).toBe('string')
    expect(json.name.length).toBeGreaterThan(0)
    expect(typeof json.short).toBe('string')
    expect(json.short.length).toBeGreaterThan(0)
  })

  it('header.vue must contain stardew theme option', () => {
    const header = readFileSync('src/components/Header.vue', 'utf8')
    expect(header).toContain('stardew')
  })
})
