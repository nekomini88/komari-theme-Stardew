/**
 * 调色板状态（用户 2026-10-13：一键切换服务器配色）。
 *
 * 模块级响应式单例（v2 目录不使用 Pinia），选择持久化到 localStorage。
 * 卡片通过 usePalette() 读取每台的底色/文字色/描边色；名牌贴图只在默认配色下显示
 * —— 贴图里的颜色是烘死的，动态配色跟不上，硬留着会出现色差接缝。
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue'

import {
  colorAt, PALETTES, randomColors, resolveNode,
  type NodeColor, type PaletteMode,
} from './palettes'

const STORAGE_KEY = 'vk-palette-mode'
const SLOT_COUNT = 6

const VALID: PaletteMode[] = ['default', 'flatpaper', 'emerald', 'random']

function loadMode(): PaletteMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return VALID.includes(v as PaletteMode) ? (v as PaletteMode) : 'default'
  } catch {
    return 'default'
  }
}

const mode = ref<PaletteMode>(loadMode())
const randomList = ref<string[]>(randomColors())

export function setPaletteMode(next: PaletteMode): void {
  if (!VALID.includes(next)) return
  mode.value = next
  // 每次切到随机都重新掷一次，避免看起来"没变"
  if (next === 'random') randomList.value = randomColors()
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* 隐私模式下 localStorage 可能不可用，忽略即可 */
  }
}

/** 随机模式下再掷一次 */
export function rerollRandom(): void {
  randomList.value = randomColors()
}

export interface UsePalette {
  mode: Ref<PaletteMode>
  /** 六台的颜色（底色 + 文字色 + 描边），已保证文字对比度 ≥4.5:1 */
  nodeColors: ComputedRef<NodeColor[]>
  /** 是否显示名牌贴图（仅默认配色） */
  showArt: ComputedRef<boolean>
  options: { mode: PaletteMode; label: string; hint: string; colors: string[] }[]
  setPaletteMode: typeof setPaletteMode
  rerollRandom: typeof rerollRandom
}

export function usePalette(): UsePalette {
  const nodeColors = computed<NodeColor[]>(() =>
    Array.from({ length: SLOT_COUNT }, (_, i) =>
      resolveNode(colorAt(mode.value, i, randomList.value))),
  )

  const options = VALID.map((m) => {
    if (m === 'random') {
      return { mode: m, label: '随机颜色', hint: '每次切换重新生成（避开不可读的明度区间）', colors: [] }
    }
    const def = PALETTES[m]
    return { mode: m, label: def.label, hint: def.hint, colors: def.colors }
  })

  return {
    mode,
    nodeColors,
    showArt: computed(() => mode.value === 'default'),
    options,
    setPaletteMode,
    rerollRandom,
  }
}
