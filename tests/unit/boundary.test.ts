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

  // 原断言为「Header.vue 必须含 stardew」,但 header 的 day/night 切换在 512da73 已移除,
  // Header.vue 自此不再出现 'farmer' → 断言过时导致 CI/Release 长期红。
  // 改为守当前真实不变量:header 只保留 admin 入口,且用像素齿轮素材 + pixelated 渲染。
  it('header must keep the admin entry rendered with the pixel gear asset', () => {
    const header = readFileSync('src/components/Header.vue', 'utf8')
    expect(header).toContain('admin-gear.png')
    expect(header).toContain('image-rendering: pixelated')
    expect(header).not.toContain('<Icon v-if')       // 不能再回退成矢量图标
  })
})
