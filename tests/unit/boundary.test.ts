import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('boundary: spec.yaml and sources', () => {
  it('spec.yaml should not have empty required fields', () => {
    const yaml = readFileSync('spec.yaml', 'utf8')
    expect(yaml).not.toContain('name: ')
    expect(yaml).not.toContain('version: ')
  })

  it('komari-theme.json must have non-empty name and short', () => {
    const json = JSON.parse(readFileSync('komari-theme.json', 'utf8'))
    expect(typeof json.name).toBe('string')
    expect(json.name.length).toBeGreaterThan(0)
    expect(typeof json.short).toBe('string')
    expect(json.short.length).toBeGreaterThan(0)
  })

  it('Header.vue must contain stardew theme option', () => {
    const header = readFileSync('src/components/Header.vue', 'utf8')
    expect(header).toContain('stardew')
  })
})
