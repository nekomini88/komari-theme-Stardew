import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..', '..')

describe('build artifacts integration', () => {
  it('mUST produce build zip', () => {
    const list = execSync(`ls ${root}/komari-theme-stardew-build-*.zip 2>/dev/null || true`, { encoding: 'utf-8' }).trim()
    expect(list).toBeTruthy()
  })

  it('mUST contain komari-theme.json in zip', () => {
    const zipPath = require('node:child_process').execSync(`ls -t ${root}/komari-theme-stardew-build-*.zip | head -1`, { encoding: 'utf-8' }).trim()
    const { execSync: run } = require('node:child_process')
    const names = run(`unzip -l ${zipPath}`, { encoding: 'utf-8' })
    expect(names).toContain('komari-theme.json')
  })

  it('mUST contain preview.png in zip', () => {
    const zipPath = require('node:child_process').execSync(`ls -t ${root}/komari-theme-stardew-build-*.zip | head -1`, { encoding: 'utf-8' }).trim()
    const names = require('node:child_process').execSync(`unzip -l ${zipPath}`, { encoding: 'utf-8' })
    expect(names).toContain('preview.png')
  })

  it('mUST have valid manifest', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'komari-theme.json'), 'utf-8'))
    expect(manifest.name).toBe('Komari Stardew')
    expect(manifest.short).toBe('stardew')
    expect(manifest.url).toContain('komari-theme-Stardew')
  })

  it('mUST have preview.png', () => {
    const preview = resolve(root, 'docs', 'preview.png')
    const stat = require('node:fs').statSync(preview)
    expect(stat.size).toBeGreaterThan(10_000)
  })
})
