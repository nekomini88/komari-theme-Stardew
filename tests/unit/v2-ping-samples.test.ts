import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PingSample } from '@/v2/data/pingSamples'
import {
  buildPingSeries,
  hhmm,
  latencyLevel,
  LATENCY_CRIT_MS,
  LATENCY_WARN_MS,
  SAMPLE_SLOTS,
} from '@/v2/data/pingSamples'

/**
 * 用户 2026-10-13：「按照参考站来」—— 延迟/丢包改成参考站那样「一格一个真实样本」。
 *
 * 参考站实测 DOM：`grid-template-columns: repeat(20, minmax(0px,1fr))` + `gap: 1px`，
 * 逐格按样本自身等级上色，无数据格为淡色。
 * 旧做法是 `width: min(100, latency)%`（把毫秒当百分比）→ 135ms 就顶满格，语义错。
 */

const TASKS = [
  { id: 1, interval: 60, name: '移动', default_on: true },
  { id: 2, interval: 60, name: '联通', default_on: true },
]

/** 造一段记录：从 03:20 起每分钟一条（task 1），skip 里的小时:分代表"该分钟丢包" */
function recs(values: Record<string, number>, taskId = 1) {
  return Object.entries(values).map(([hm, value]) => ({
    task_id: taskId,
    time: `2026-10-13T${hm}:00Z`,
    value,
  }))
}

describe('延迟分级阈值', () => {
  it('小于 warn 阈值 → ok', () => {
    expect(latencyLevel(0)).toBe('ok')
    expect(latencyLevel(LATENCY_WARN_MS - 1)).toBe('ok')
  })

  it('warn 与 crit 阈值边界', () => {
    expect(latencyLevel(LATENCY_WARN_MS)).toBe('warn')
    expect(latencyLevel(LATENCY_CRIT_MS - 1)).toBe('warn')
    expect(latencyLevel(LATENCY_CRIT_MS)).toBe('crit')
    expect(latencyLevel(9999)).toBe('crit')
  })

  it('非法值视为无数据', () => {
    expect(latencyLevel(undefined)).toBe('none')
    expect(latencyLevel(null)).toBe('none')
    expect(latencyLevel(-1)).toBe('none')
    expect(latencyLevel(Number.NaN)).toBe('none')
  })
})

describe('hhmm：按服务器给的时间原样截取（不做本地时区换算）', () => {
  it('ISO → HH:mm', () => {
    expect(hhmm('2026-10-13T03:25:00Z')).toBe('03:25')
    expect(hhmm('坏数据')).toBe('--:--')
  })
})

describe('buildPingSeries：一格一个真实样本', () => {
  it('固定 20 格', () => {
    const s = buildPingSeries(recs({ '03:25': 40 }), TASKS, '2026-10-13T03:25:00Z')
    expect(s.latency).toHaveLength(SAMPLE_SLOTS)
    expect(s.loss).toHaveLength(SAMPLE_SLOTS)
    expect(SAMPLE_SLOTS).toBe(20)
  })

  it('末格 = 窗口结束时刻那一分钟，倒序铺满 20 格', () => {
    const s = buildPingSeries(recs({ '03:25': 40 }), TASKS, '2026-10-13T03:25:00Z')
    expect(s.latency[19]!.at).toBe('03:25')
    expect(s.latency[18]!.at).toBe('03:24')
    expect(s.latency[0]!.at).toBe('03:06') // 19 分钟前
  })

  it('有样本的分钟：延迟按值分级、丢包记为到达', () => {
    const s = buildPingSeries(
      recs({ '03:24': 50, '03:25': 240 }),
      TASKS,
      '2026-10-13T03:25:00Z',
    )
    expect(s.latency[18]!.level).toBe('ok') // 50ms
    expect(s.latency[19]!.level).toBe('crit') // 240ms
    expect(s.loss[18]!.level).toBe('ok')
    expect(s.loss[19]!.level).toBe('ok')
    expect(s.latency[19]!.title).toContain('240')
  })

  it('缺记录的分钟 = 丢包（丢包格红、延迟格无数据）—— 与参考站 1.0% → 19 绿 + 1 红一致', () => {
    const values: Record<string, number> = {}
    // 03:06~03:25 共 20 分钟，唯独 03:15 缺席
    for (let i = 0; i < 20; i++) {
      const m = 6 + i
      if (m === 15)
        continue
      values[`03:${String(m).padStart(2, '0')}`] = 45
    }
    const s = buildPingSeries(recs(values), TASKS, '2026-10-13T03:25:00Z')
    const lossOk = s.loss.filter((x: PingSample) => x.level === 'ok').length
    const lossCrit = s.loss.filter((x: PingSample) => x.level === 'crit').length
    expect(lossOk, '19 格到达').toBe(19)
    expect(lossCrit, '1 格丢包').toBe(1)
    // 延迟格在丢包那一格是"无数据"（淡色），不是 0ms
    expect(s.latency.filter((x: PingSample) => x.level === 'none')).toHaveLength(1)
    expect(s.loss.find((x: PingSample) => x.level === 'crit')!.title).toContain('丢包')
  })

  it('value = -1 是 komari 的 ping 失败哨兵，同样算丢包（不能算"到达"）', () => {
    // 实测依据：de-rabisu 61 条样本里有 1 条 value=-1，该任务 loss 字段恰为 1.639% = 1/61
    const values: Record<string, number> = {}
    for (let i = 0; i < 20; i++) {
      const m = 6 + i
      values[`03:${String(m).padStart(2, '0')}`] = m === 15 ? -1 : 45
    }
    const s = buildPingSeries(recs(values), TASKS, '2026-10-13T03:25:00Z')
    const crit = s.loss.filter((x: PingSample) => x.level === 'crit')
    expect(crit, '有记录但值为 -1 仍是丢包').toHaveLength(1)
    expect(crit[0]!.title).toContain('失败')
    expect(s.latency.filter((x: PingSample) => x.level === 'none')).toHaveLength(1)
    expect(s.latency.filter((x: PingSample) => x.level === 'ok')).toHaveLength(19)
  })

  it('无任何数据：延迟全 none、丢包全 crit（并给出 tooltip）', () => {
    const s = buildPingSeries([], TASKS, '2026-10-13T03:25:00Z')
    expect(s.latency.every((x: PingSample) => x.level === 'none')).toBe(true)
    expect(s.loss.every((x: PingSample) => x.level === 'crit')).toBe(true)
    expect(s.latency.every((x: PingSample) => !!x.title)).toBe(true)
  })

  it('优先取 default_on 的主任务', () => {
    const both = [
      ...recs({ '03:25': 40 }, 1),
      ...recs({ '03:25': 300 }, 2),
    ]
    const s = buildPingSeries(both, TASKS, '2026-10-13T03:25:00Z')
    expect(s.latency[19]!.value, '应取主任务(task 1)的 40ms，而不是 task 2 的 300ms').toBe(40)
  })
})

describe('样式与旧语义防回归', () => {
  const css = readFileSync(resolve(__dirname, '..', '..', 'src', 'styles', 'v2', 'card.css'), 'utf8')
  const vue = readFileSync(resolve(__dirname, '..', '..', 'src', 'v2', 'components', 'NodeCard.vue'), 'utf8')
  const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '')

  it('CSS 用参考站那样 20 列网格 + 1px 缝', () => {
    const block = css.match(/\.vk-samples \{[\s\S]*?\}/)?.[0] ?? ''
    expect(block, '未找到 .vk-samples').not.toBe('')
    const flat = block.replace(/\s+/g, ' ')
    expect(flat).toContain('grid-template-columns: repeat(20, minmax(0, 1fr))')
    expect(flat).toContain('gap: 1px')
  })

  it('四级配色齐全（含无数据态）', () => {
    const flat = strip(css).replace(/\s+/g, ' ')
    for (const lv of ['ok', 'warn', 'crit', 'none'])
      expect(flat.includes(`[data-level='${lv}']`), `缺少 ${lv} 级`).toBe(true)
  })

  it('延迟/丢包不得退回「毫秒当百分比」的旧语义', () => {
    // 剥注释后断言 —— 注释里记录旧写法是允许的，代码里不能有
    expect(strip(vue)).not.toContain('min(100, node.latency')
    expect(strip(vue)).not.toContain('min(100, node.loss')
    // 两处都应换成样本条
    expect(strip(vue)).toContain('series.latency')
    expect(strip(vue)).toContain('series.loss')
  })
})
