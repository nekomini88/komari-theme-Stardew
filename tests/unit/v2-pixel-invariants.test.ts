import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..')
const v2StyleDir = resolve(ROOT, 'src/styles/v2')
const v2ComponentDir = resolve(ROOT, 'src/v2')

/** 全部 v2 样式表拼接（用于「类名是否被定义」的检查） */
function allStyles(): string {
  return readdirSync(v2StyleDir)
    .filter(f => f.endsWith('.css'))
    .map(f => readFileSync(resolve(v2StyleDir, f), 'utf8'))
    .join('\n')
}

/** 收集 v2 组件/视图模板里用到的 vk- 前缀类名 */
function usedClasses(): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = resolve(dir, e.name)
    return e.isDirectory() ? walk(p) : (e.name.endsWith('.vue') ? [p] : [])
  })
  for (const f of walk(v2ComponentDir)) {
    const src = readFileSync(f, 'utf8')
    const tmpl = src.slice(src.indexOf('<template>'))
    for (const m of tmpl.matchAll(/class="([^"]+)"/g)) {
      for (const c of (m[1] ?? '').split(/\s+/)) {
        if (!c.startsWith('vk-'))
          continue
        const file = f.replace(`${ROOT}/`, '')
        out.set(c, [...(out.get(c) ?? []), file])
      }
    }
  }
  return out
}

/**
 * 有意不单独定义样式的类名（有明确理由，不是遗漏）。
 * 加进来必须写清原因，避免这里变成「把漏掉的类名藏起来」的地方。
 */
const INTENTIONALLY_UNSTYLED: Record<string, string> = {
  'vk-node-card': '语义锚点：样式由同时在身的 .vk-panel 提供；测试与 e2e 探针依赖这个类名',
  'vk-card-head': '语义锚点：样式由同时在身的 .vk-panel-head 提供',
  'vk-card-body': '语义锚点：样式由同时在身的 .vk-panel-body 提供',
  'vk-card-name': '语义锚点：样式由同时在身的 .vk-panel-name 提供',
  'vk-card-status': '语义锚点：样式由 .vk-visually-hidden 提供（状态另由圆点 + title 表达）',
  'vk-card-head-icon': '语义锚点：样式由同时在身的 .vk-panel-head-icon 提供',
  'vk-font-display': '工具类：由 tokens.css 的 .vk-font-display 定义（此断言只扫 vk- 前缀，故列出备查）',
  'vk-font-body': '工具类：由 tokens.css 的 .vk-font-body 定义',
  'vk-ping-chart': '容器钩子：仅带 data-testid="ping-chart"，内层元素由 .vk-chart* 上样式，本身无需样式',
}

describe('像素风硬约束（每次改样式都要过）', () => {
  it('v2 模板用到的每个 vk- 类名都真的有样式定义（防「整份覆盖 CSS 丢样式」复发）', () => {
    const styles = allStyles()
    const used = usedClasses()
    const missing: string[] = []
    for (const [cls, files] of used) {
      if (cls in INTENTIONALLY_UNSTYLED)
        continue
      // 类名在样式表里以 .类名 出现过即可
      const re = new RegExp(`\\.${cls.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?![\\w-])`)
      if (!re.test(styles))
        missing.push(`.${cls}  (用于 ${[...new Set(files)].join(', ')})`)
    }
    expect(missing, `以下类名被模板使用但没有任何样式定义：\n${missing.join('\n')}`).toEqual([])
  })

  it('像素图标尺寸必须是原生逻辑尺寸 16px 的整数倍（非整数倍必然糊）', () => {
    const src = readFileSync(resolve(ROOT, 'src/v2/components/NodeCard.vue'), 'utf8')
    const sizes = [...src.matchAll(/<PixelIcon[^>]*:size="(\d+)"/g)].map(m => Number(m[1]))
    expect(sizes.length).toBeGreaterThan(0)
    for (const s of sizes)
      expect(s % 16, `图标尺寸 ${s}px 不是 16 的整数倍 → 每个逻辑像素会落到小数个设备像素上`).toBe(0)
  })

  it('像素字号必须是设计尺寸 12px 的整数倍', () => {
    const tokens = readFileSync(resolve(v2StyleDir, 'tokens.css'), 'utf8')
    for (const name of ['--vk-fs-sm', '--vk-fs-md', '--vk-fs-lg']) {
      const m = tokens.match(new RegExp(`${name}:\\s*(\\d+)px`))
      expect(m, `${name} 未定义`).toBeTruthy()
      expect(Number(m![1]) % 12, `${name}=${m![1]}px 不是 12 的整数倍`).toBe(0)
    }
  })

  it('像素字不使用合成加粗（会把像素格糊掉）', () => {
    const card = readFileSync(resolve(v2StyleDir, 'card.css'), 'utf8')
    const home = readFileSync(resolve(v2StyleDir, 'home.css'), 'utf8')
    for (const [file, css] of [['card.css', card], ['home.css', home]] as const) {
      const bad = [...css.matchAll(/font-weight:\s*(6\d\d|7\d\d|8\d\d|9\d\d|bold)/g)]
      expect(bad.map(b => b[0]), `${file} 里出现合成加粗`).toEqual([])
    }
  })
})
