/**
 * 卡片外观状态（用户 2026-10-13 定稿：两选一，选择持久化）。
 *
 * 模块级响应式单例（v2 目录不使用 Pinia）。
 * 卡片通过 usePalette() 读取材质与每台名称行的底色/文字色/描边色。
 * 名牌贴图只在纸卡模式显示 —— 贴图里的颜色是烘死的，玻璃模式不需要它。
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue'

import {
  DEFAULT_MODE, materialOf, nodeColorAt, PALETTES, PALETTE_MODES,
  SLOT_COUNT,
  type Material, type NodeColor, type PaletteMode,
} from './palettes'

const STORAGE_KEY = 'vk-palette-mode'

/** 只有当前有效的模式会被接受；历史值（default/random 等已废弃的模式）一律回落到默认 */
function loadMode(): PaletteMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return PALETTE_MODES.includes(v as PaletteMode) ? (v as PaletteMode) : DEFAULT_MODE
  } catch {
    return DEFAULT_MODE
  }
}

const mode = ref<PaletteMode>(loadMode())

export function setPaletteMode(next: PaletteMode): void {
  if (!PALETTE_MODES.includes(next)) return
  mode.value = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* 隐私模式下 localStorage 可能不可用，忽略即可 */
  }
}

export interface PaletteOption {
  mode: PaletteMode
  label: string
  hint: string
  material: Material
  colors: string[]
}

export interface UsePalette {
  mode: Ref<PaletteMode>
  material: ComputedRef<Material>
  /** 六台名称行的配色（玻璃模式为透明底 + 近黑字） */
  nodeColors: ComputedRef<NodeColor[]>
  /** 是否显示名牌贴图（只纸卡模式有） */
  showArt: ComputedRef<boolean>
  options: PaletteOption[]
  setPaletteMode: typeof setPaletteMode
}

export function usePalette(): UsePalette {
  return {
    mode,
    material: computed(() => materialOf(mode.value)),
    nodeColors: computed<NodeColor[]>(() =>
      Array.from({ length: SLOT_COUNT }, (_, i) => nodeColorAt(mode.value, i)),
    ),
    showArt: computed(() => materialOf(mode.value) === 'paper'),
    options: PALETTE_MODES.map((m) => ({
      mode: m,
      label: PALETTES[m].label,
      hint: PALETTES[m].hint,
      material: PALETTES[m].material,
      colors: PALETTES[m].colors,
    })),
    setPaletteMode,
  }
}
