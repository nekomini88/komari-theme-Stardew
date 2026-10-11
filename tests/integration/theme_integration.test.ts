import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// 契约对齐（依据：当前 main @3ec71b7 实际源码/产物）：
// - 主题键真身 = 'Komari-Stardew'（komari-theme.json short，旧 'stardew' 键已废弃）。
// - 视觉风格由 useVisualStyle 把 data-theme='stardew' 挂到 document.documentElement，
//   CSS 选择器统一用【单引号】[data-theme='stardew']，分布在 visual-styles.css /
//   matte-pixel.css / hard-pixel-core.css；main.css 只经 @import 引入这些分层文件。
// - Header.vue 的 day/night 与风格切换按钮在 512da73 已移除，只保留 admin 入口
//   （/images/icons/admin-gear.png + image-rendering: pixelated）。

describe('theme integration', () => {
  it('exposes the stardew visual style through the manifest + useVisualStyle contract', () => {
    // 依据：komari-theme.json configuration.data → themeVisualStyle（type=select, default=stardew, options 含 stardew）
    const manifest = JSON.parse(readFileSync('komari-theme.json', 'utf-8'))
    const visual = manifest.configuration.data.find((d: { key?: string }) => d.key === 'themeVisualStyle')
    expect(visual?.type).toBe('select')
    expect(visual?.default).toBe('stardew')
    expect(String(visual?.options).split(',')).toContain('stardew')

    // 依据：src/composables/useVisualStyle.ts → ALLOWED=['stardew','baseline'] 且 apply() setAttribute('data-theme','stardew')
    const util = readFileSync('src/composables/useVisualStyle.ts', 'utf-8')
    expect(util).toContain('[\'stardew\', \'baseline\']')
    expect(util).toContain('setAttribute(\'data-theme\', \'stardew\')')
  })

  it('defines stardew visual-style css tokens in the visual-styles layer', () => {
    // 依据：src/styles/visual-styles.css 在 [data-theme='stardew']（单引号）下定义视觉令牌
    const css = readFileSync('src/styles/visual-styles.css', 'utf-8')
    expect(css).toContain('[data-theme=\'stardew\']')
    expect(css).toContain('--visual-radius-panel')
    expect(css).toContain('--visual-panel-shadow')

    // 依据：src/styles/main.css L1 引入 @fontsource/press-start-2p 的真实像素字体，
    // 且 main.css 通过 @import 汇入 visual-styles.css 分层（旧断言查 'Jersey 10' 已不在字体链中）
    const main = readFileSync('src/styles/main.css', 'utf-8')
    expect(main).toContain('press-start-2p')
    expect(main).toContain('visual-styles.css')
  })
})

describe('matte pixel surfaces under stardew theme', () => {
  it('mUST disable glass blur and enforce matte surfaces via the matte-pixel layer', () => {
    // 依据：main.css L10 @import './matte-pixel.css'（分层引入，规则本体不在 main.css）
    const main = readFileSync('src/styles/main.css', 'utf8')
    expect(main).toContain('matte-pixel.css')

    // 依据：src/styles/matte-pixel.css 中 .backdrop-blur-* 覆盖为 backdrop-filter: none !important
    const matte = readFileSync('src/styles/matte-pixel.css', 'utf8')
    expect(matte).toContain('[data-theme=\'stardew\']')
    expect(matte).toContain('backdrop-filter: none !important')
    expect(matte).toContain('box-shadow:')
    expect(matte).toContain('var(--border-strong')
  })

  it('mUST use dotted matte borders and pixel shadows in matte-pixel.css', () => {
    const matte = readFileSync('src/styles/matte-pixel.css', 'utf8')
    expect(matte).toContain('[data-theme=\'stardew\']')
    // dotted 以 border-style 或简写表达均可
    const dotted = ['border-style: dotted', 'border: 2px dotted'].some(t => matte.includes(t))
    expect(dotted).toBe(true)
    // 像素硬阴影签名
    expect(matte).toContain('4px 4px 0 0 var(--border-strong')
  })
})
