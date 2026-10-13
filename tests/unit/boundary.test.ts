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

  // 2026-10-13 迁移：原断言读 v1 顶栏组件（已随 v1 层删除）。
  // 不变量不变 —— 顶栏必须保留可达的 admin 入口；改指活顶栏 src/v2/components/TopBar.vue。
  it('top bar must keep the admin entry reachable', () => {
    const header = readFileSync('src/v2/components/TopBar.vue', 'utf8')
    expect(header).toContain('/admin')
    expect(header).toContain('aria-label')
    expect(header).toContain('type="button"')
  })
})
