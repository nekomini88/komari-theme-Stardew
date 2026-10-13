import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { contrastRatio, decodePng, dominantColor } from '../helpers/png'
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
    for (const name of ['--vk-fs-sm', '--vk-fs-lg']) {
      const m = tokens.match(new RegExp(`${name}:\\s*(\\d+)px`))
      expect(m, `${name} 未定义`).toBeTruthy()
      expect(Number(m![1]) % 12, `${name}=${m![1]}px 不是 12 的整数倍`).toBe(0)
    }
  })

  it('名称不得再用四向 1px 硬描边（会把几何粗体做成贴纸质感）', () => {
    const card = readFileSync(resolve(v2StyleDir, 'card.css'), 'utf8')
    const all = [...card.matchAll(/\.vk-panel-name \{[\s\S]*?\}/g)].map(m => m[0])
    const main = all.sort((a, b) => b.length - a.length)[0] ?? ''
    expect(main, '名称又回到四向硬描边了').not.toMatch(/text-shadow:\s*\n?\s*1px 0 0/)
    expect(main, '名称应使用柔和投影').toMatch(/text-shadow:\s*0 1px 2px/)
  })

  /**
   * 用户 2026-10-13：「服务器字体要大, 粗体几何无衬线字体（Bold Geometric Sans-Serif）」。
   * 于是加粗不再一律禁止 —— 但必须区分"真字重"与"合成加粗"：
   *   · 像素字（Fusion Pixel 只有 400 字重）上加粗 = 浏览器合成 = 像素格被糊掉 ⇒ 仍然禁止；
   *   · 几何无衬线用**真实 800 字重字体文件** ⇒ 允许。
   * 判据：出现 600+ 字重的规则块，必须同时声明 font-family: var(--vk-font-name)。
   */
  it('加粗只允许出现在几何无衬线名上（像素字不得合成加粗）', () => {
    const card = readFileSync(resolve(v2StyleDir, 'card.css'), 'utf8')
    const home = readFileSync(resolve(v2StyleDir, 'home.css'), 'utf8')
    for (const [file, css] of [['card.css', card], ['home.css', home]] as const) {
      // 按规则块切分（本目录 CSS 不含嵌套规则，按 } 切足够）
      const blocks = css.split('}')
      for (const blk of blocks) {
        if (!/font-weight:\s*(6\d\d|7\d\d|8\d\d|9\d\d|bold)/.test(blk)) continue
        const sel = blk.split('{')[0]?.trim().split('\n').pop()?.trim() ?? ''
        expect(blk, `${file} 的「${sel}」用了加粗却没有用几何无衬线名 ⇒ 可能是像素字合成加粗`)
          .toContain('font-family: var(--vk-font-name)')
      }
    }
  })

  it('几何无衬线字体是真 800 字重文件（不是合成加粗），且文件真的在仓库里', () => {
    const tokens = readFileSync(resolve(v2StyleDir, 'tokens.css'), 'utf8')
    for (const f of ['montserrat-latin-800-normal.woff2', 'montserrat-latin-ext-800-normal.woff2']) {
      expect(existsSync(resolve(ROOT, 'public/fonts', f)), `${f} 缺失`).toBe(true)
    }
    // @font-face 必须声明 font-weight: 800（声明 400 才会被浏览器合成加粗）
    const faces = [...tokens.matchAll(/@font-face \{[\s\S]*?\}/g)]
      .map(m => m[0]).filter(f => f.includes("'Montserrat ExtraBold'"))
    expect(faces.length, 'Montserrat ExtraBold 的 @font-face 缺失').toBe(2)
    for (const f of faces) expect(f, '@font-face 未声明 800 字重').toMatch(/font-weight:\s*800/)
    // 名称规则必须走这个字体族
    expect(card_css_name_rule(tokens)).toBe(true)
  })
})

describe('标题文字色必须与底板横幅色配对（自动审核：防「字色与横幅不配」复发）', () => {
  const tokens = readFileSync(resolve(v2StyleDir, 'tokens.css'), 'utf8')
  const panelDir = resolve(ROOT, 'public/images/v2-panel')

  /**
   * 取「标题文字实际所在的横幅中央主体」的颜色 —— 直接解码底板 PNG。
   * 不能读一份手写的事实表：事实表会与实际产物脱节，等于没验。
   * 区域按底板比例取：中央主体 x 28%..75.5%、横幅上半 y 1%..11.5%（底板 428×394 → x120..323, y4..45）。
   */
  function bannerColorOf(slot: number): { hex: string, size: [number, number] } {
    const img = decodePng(readFileSync(resolve(panelDir, `panel-${slot}.png`)))
    // 底板现在是「横幅条」（428x56）。取样区域必须落在**标题实际压着的那块平色横幅**上：
    // 横向取两叶簇之间的中央主体（28%~75.5%），纵向取条高的中段（30%~70%）——
    // 取顶部会采到叶缘高光、取更宽会带上两端叶簇，两者都会得出错误底色。
    const x0 = Math.round(img.width * 0.28)
    const x1 = Math.round(img.width * 0.755)
    const y0 = Math.round(img.height * 0.30)
    const y1 = Math.round(img.height * 0.70)
    return { hex: dominantColor(img, x0, x1, y0, y1), size: [img.width, img.height] }
  }

  it('6 个色槽：底板横幅实测色 与 --vk-node-ink-N 的对比度都 ≥3:1（WCAG 大号文本 AA）', () => {
    for (let i = 1; i <= 6; i++) {
      const { hex, size } = bannerColorOf(i)
      const ink = tokens.match(new RegExp(`--vk-node-ink-${i}:\\s*(#[0-9a-fA-F]{6})`))?.[1]
      expect(ink, `--vk-node-ink-${i} 未定义`).toBeTruthy()
      const c = contrastRatio(hex, ink!)
      expect(c, `第 ${i} 槽：底板横幅实测 ${hex}（${size[0]}x${size[1]}）与文字 ${ink} 对比度仅 ${c.toFixed(2)}，不足 3:1`)
        .toBeGreaterThanOrEqual(3)
    }
  })

  it('描边取与文字相反的色调（参考稿口径：浅色字配深色描边）', () => {
    for (let i = 1; i <= 6; i++) {
      const ink = tokens.match(new RegExp(`--vk-node-ink-${i}:\\s*(#[0-9a-fA-F]{6})`))![1]!
      const sh = tokens.match(new RegExp(`--vk-node-shadow-${i}:\\s*(#[0-9a-fA-F]{6})`))![1]!
      const inkDark = contrastRatio(ink, '#000000') > contrastRatio(ink, '#ffffff')
      const shDark = contrastRatio(sh, '#000000') > contrastRatio(sh, '#ffffff')
      expect(inkDark, `第 ${i} 槽：文字与描边明暗同向（起不到分离作用）`).not.toBe(shDark)
    }
  })

  it('标题栏比例与底板横幅条一致（条图改了必须同步 .vk-panel-head 的 aspect-ratio）', () => {
    const cardCss = readFileSync(resolve(v2StyleDir, 'card.css'), 'utf8')
    // 取 .vk-panel-head 规则块内的 aspect-ratio
    const headBlock = cardCss.match(/\.vk-panel-head\s*\{[^}]*\}/)?.[0] ?? ''
    const m = headBlock.match(/aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/)
    expect(m, '.vk-panel-head 未锁定横幅条比例（会导致标题栏与条图错位）').toBeTruthy()
    const [w, h] = [Number(m![1]), Number(m![2])]
    const { size } = bannerColorOf(1)
    expect(Math.abs(w / h - size[0] / size[1]),
      `标题栏比例 ${w}/${h} 与条图 ${size[0]}x${size[1]} 不一致`).toBeLessThan(0.05)
  })

  it('正文高度由内容决定，不再锁 aspect-ratio（防再次静默裁掉底部指标）', () => {
    const cardCss = readFileSync(resolve(v2StyleDir, 'card.css'), 'utf8')
    const stripped = cardCss.replace(/\/\*[\s\S]*?\*\//g, '')   // 先剥注释：否则注释里提到该属性也会误判
    const panelBlock = stripped.match(/\.vk-panel\s*\{[^}]*\}/)?.[0] ?? ''
    expect(panelBlock, '.vk-panel 不该再锁 aspect-ratio —— 曾因此把最后两行指标裁掉')
      .not.toContain('aspect-ratio')
  })
})

describe('等级配色选择器必须与 usageLevel() 的返回值一致（防死规则复发）', () => {
  it('card.css 里的 [data-level=...] 取值都在 ok/warn/crit 之内', () => {
    const css = readFileSync(resolve(v2StyleDir, 'card.css'), 'utf8')
    const used = [...css.matchAll(/\[data-level='([a-z]+)'\]/g)].map(m => m[1])
    expect(used.length, '未找到任何 [data-level=...] 规则').toBeGreaterThan(0)
    // 与 metrics.ts 里 usageLevel 的返回值对齐 —— 写成 alert/danger 会永远匹配不上，是死代码
    // none = 「无数据」态（延迟格缺样本；参考站的无数据格也是淡色），其余对齐 usageLevel 的返回值
    const allowed = ['ok', 'warn', 'crit', 'none']
    for (const v of used)
      expect(allowed, `[data-level='${v}'] 不在 usageLevel 的可能返回值 ${allowed.join('/')} 之内 → 永远不生效`).toContain(v)
  })
})

/** 名称规则必须真的用上几何无衬线字族（防止只能改了 token 而规则没接上） */
function card_css_name_rule(_tokens: string): boolean {
  const card = readFileSync(resolve(v2StyleDir, 'card.css'), 'utf8')
  const all = [...card.matchAll(/\.vk-panel-name \{[\s\S]*?\}/g)].map(m => m[0])
  const main = all.sort((a, b) => b.length - a.length)[0] ?? ''
  return main.includes('font-family: var(--vk-font-name)')
    && /font-weight:\s*800/.test(main)
}
