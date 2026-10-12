/**
 * 场景生态纯逻辑（SceneStack 的「植物生长循环」与「随机动物彩蛋」）。
 *
 * 目标（DESIGN_REFERENCE §4/§5）：
 *  - 植物系统：萌发 → 生长 → 结果 → 枯萎 一个生命周期，并与季节挂钩（春/夏茂盛、秋结果、冬枯）。
 *  - 随机动物事件：小鹿/野兔等偶尔现身，属彩蛋；不得遮挡卡片数据。
 *
 * 关键约束：**确定性伪随机** —— 位置/时机不可每次刷新乱跳。
 *  故所有随机量都由「季节字符串」播种的 mulberry32 PRNG 生成：
 *  同一季节 → 完全相同的布局；换季 → 布局自然更替（= 按季节播种）。
 *
 * 纯函数、无副作用 → 可直接单测。渲染图元与 CSS 动画在 SceneLife.vue。
 */

import type { Season } from './sceneState'

/** 作物生长阶段：萌发 / 生长 / 结果 / 枯萎 */
export type CropStage = 'sprout' | 'grow' | 'fruit' | 'wither'

/** 单株作物的确定性摆放与生长参数 */
export interface CropSpec {
  id: number
  /** 横向位置（占场景宽度百分比 0..100） */
  x: number
  /** 整体缩放（0.7..1.15） */
  scale: number
  /** 生长阶段（与季节挂钩） */
  stage: CropStage
  /** 生长循环相位偏移（秒，负值 = 提前起跑），使田里各株不同步 */
  delay: number
  /** 色相微扰 0..1（果实的橙/叶的绿微调），确定性 */
  tone: number
  /** 摇曳周期（秒） */
  swayDur: number
  /** 基础纵向抬升（px），让田垄有前后层次 */
  lift: number
}

/** 动物种类 */
export type FaunaKind = 'deer' | 'rabbit' | 'bird'

/** 单个动物彩蛋的确定性排期 */
export interface FaunaSpec {
  id: number
  kind: FaunaKind
  /** 入场方向：1 = 从左往右，-1 = 从右往左 */
  dir: 1 | -1
  /** 起始相位偏移（秒），决定「多久才偶尔现身」 */
  delay: number
  /** 全程周期（秒）：只有末尾一小段在画面内 → 低频彩蛋 */
  duration: number
  /** 站立线纵向微扰（px） */
  y: number
  scale: number
}

/** FNV-1a 字符串 → 32 位无符号整数种子 */
export function hashSeed(str: string): number {
  let h = 0x811C9DC5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 —— 小、快、确定性的 PRNG，返回 [0,1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 季节 → 生长阶段的权重表（「与季节挂钩」的核心口径）：
 *  春：嫩芽为主 → 萌发/生长；夏：茂盛 → 生长；秋：结果；冬：枯萎（覆雪）。
 * 列中出现次数即权重。
 */
const STAGE_POOL: Record<Season, CropStage[]> = {
  spring: ['sprout', 'sprout', 'sprout', 'grow', 'grow', 'fruit'],
  summer: ['grow', 'grow', 'grow', 'grow', 'fruit', 'fruit'],
  autumn: ['fruit', 'fruit', 'fruit', 'grow', 'wither'],
  winter: ['wither', 'wither', 'wither', 'wither', 'sprout'],
}

/**
 * 按季节播种出一畦作物（确定性）。
 * @param season 当前季节
 * @param count  株数（默认 10）
 */
export function cropField(season: Season, count = 10): CropSpec[] {
  const rnd = mulberry32(hashSeed(`crop:${season}`))
  const pool = STAGE_POOL[season]
  const out: CropSpec[] = []
  for (let i = 0; i < count; i++) {
    // 横向均分 + 抖动，避免整齐得发假；抖动仍是确定性的
    const slot = (i + 0.5) / count
    const jitterX = (rnd() - 0.5) * (0.7 / count)
    const stage = pool[Math.floor(rnd() * pool.length)] ?? 'grow'
    out.push({
      id: i,
      x: Math.round((slot + jitterX) * 1000) / 10,
      scale: Math.round((0.72 + rnd() * 0.46) * 100) / 100,
      stage,
      // 负延迟：让各株错开生长相位（确定性）
      delay: -Math.round(rnd() * 22 * 10) / 10,
      tone: Math.round(rnd() * 1000) / 1000,
      swayDur: Math.round((3.2 + rnd() * 2.6) * 100) / 100,
      lift: Math.round(rnd() * 10),
    })
  }
  return out
}

/** 季节 → 可能出没的动物（确定性物种表） */
const FAUNA_POOL: Record<Season, FaunaKind[]> = {
  spring: ['rabbit', 'bird', 'rabbit'],
  summer: ['deer', 'rabbit', 'bird'],
  autumn: ['deer', 'deer', 'rabbit'],
  winter: ['deer', 'rabbit', 'rabbit'],
}

/**
 * 按季节播种出动物彩蛋排期（确定性、低频）。
 * 每个动物在一个很长的周期里只在末尾 ~18% 穿越画面 → 「偶尔现身」。
 */
export function faunaPlan(season: Season, count = 2): FaunaSpec[] {
  const rnd = mulberry32(hashSeed(`fauna:${season}`))
  const pool = FAUNA_POOL[season]
  const out: FaunaSpec[] = []
  for (let i = 0; i < count; i++) {
    const kind = pool[Math.floor(rnd() * pool.length)] ?? 'rabbit'
    const dir: 1 | -1 = rnd() < 0.5 ? 1 : -1
    const duration = 46 + Math.round(rnd() * 20) // 46..66s 长周期
    out.push({
      id: i,
      kind,
      dir,
      delay: -Math.round(rnd() * duration), // 相位错开：不同时刻才现身
      duration,
      y: Math.round(rnd() * 12),
      scale: Math.round((0.85 + rnd() * 0.4) * 100) / 100,
    })
  }
  return out
}

/** 供 UI/探针判断某季节是否有果实/覆雪等（避免在模板里重复魔数） */
export function seasonHasFruit(season: Season): boolean {
  return season === 'autumn' || season === 'summer'
}

export function seasonIsSnowy(season: Season): boolean {
  return season === 'winter'
}
