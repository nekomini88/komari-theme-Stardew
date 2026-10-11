import { execSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..', '..')

// 契约对齐（依据：scripts/package-theme.ts L62）：
// 打包产物 = release/komari-theme-Komari-Stardew-v<version>-<hash>.zip
// （主题键为 'Komari-Stardew'，旧断言 glob 的 komari-theme-stardew-build-*.zip 在仓库根已不存在）
const zipGlob = `${root}/release/komari-theme-Komari-Stardew-v*.zip`

function latestZip(): string {
  return execSync(`ls -t ${zipGlob} | head -1`, { encoding: 'utf-8' }).trim()
}

describe('build artifacts integration', () => {
  it('mUST produce build zip under release/', () => {
    const list = execSync(`ls ${zipGlob} 2>/dev/null || true`, { encoding: 'utf-8' }).trim()
    expect(list).toBeTruthy()
  })

  it('mUST contain komari-theme.json in zip', () => {
    // 依据：scripts/package-theme.ts L78 archive.file(themeJsonPath, { name: 'komari-theme.json' })
    const names = execSync(`unzip -l ${latestZip()}`, { encoding: 'utf-8' })
    expect(names).toContain('komari-theme.json')
  })

  it('mUST contain preview.png in zip', () => {
    // 依据：scripts/package-theme.ts L80 archive.file(previewPath, { name: 'preview.png' })
    const names = execSync(`unzip -l ${latestZip()}`, { encoding: 'utf-8' })
    expect(names).toContain('preview.png')
  })

  it('mUST have valid manifest', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'komari-theme.json'), 'utf-8'))
    expect(manifest.name).toBe('Komari Stardew')
    // 依据：komari-theme.json L3 short = 'Komari-Stardew'（旧 'stardew' 键已废弃）
    expect(manifest.short).toBe('Komari-Stardew')
    expect(manifest.url).toContain('komari-theme-Stardew')
  })

  it('mUST have preview.png', () => {
    const preview = resolve(root, 'docs', 'preview.png')
    const stat = statSync(preview)
    expect(stat.size).toBeGreaterThan(10_000)
  })
})
