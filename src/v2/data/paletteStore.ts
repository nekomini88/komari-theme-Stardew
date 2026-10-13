/**
 * 卡片外观状态（用户 2026-10-13 定稿：目前只有 flatpaper 一种）。
 * 保留"模式 + 持久化"这套机械，作为以后加配色的占位（用户明确要求保留按钮）。
 *
 * 模块级响应式单例（v2 目录不使用 Pinia）。
 * 卡片通过 usePalette() 读取每台名称行的底色/文字色/描边色与名牌贴图地址。
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue'

import {
  DEFAULT_MODE, nodeColorAt, PALETTES, PALETTE_MODES, SLOT_COUNT,
  type NodeColor, type PaletteMode,
} from './palettes'

const STORAGE_KEY = 'vk-palette-mode'

/** 只有当前有效的模式会被接受；历史值（default/random 等已废弃的模式）一律回落到默认 */
function loadMode(): PaletteMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (PALETTE_MODES.includes(v as PaletteMode)) return v as PaletteMode
    // 无效/已废弃的值（如已删掉的 emerald）顺手规整掉，别让废值长期留在浏览器里
    if (v !== null) localStorage.setItem(STORAGE_KEY, DEFAULT_MODE)
    return DEFAULT_MODE
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
  colors: string[]
}

export interface UsePalette {
  mode: Ref<PaletteMode>
  /** 六台名称行的配色 */
  nodeColors: ComputedRef<NodeColor[]>
  options: PaletteOption[]
  setPaletteMode: typeof setPaletteMode
}

export function usePalette(): UsePalette {
  return {
    mode,
    nodeColors: computed<NodeColor[]>(() =>
      Array.from({ length: SLOT_COUNT }, (_, i) => nodeColorAt(mode.value, i)),
    ),
    options: PALETTE_MODES.map((m) => ({
      mode: m,
      label: PALETTES[m].label,
      hint: PALETTES[m].hint,
      colors: PALETTES[m].colors,
    })),
    setPaletteMode,
  }
}
