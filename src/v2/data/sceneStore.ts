/**
 * 场景素材组状态：目前两套（gpt-image-2 / seedream），选择持久化到 localStorage。
 *
 * 模块级响应式单例（v2 目录不使用 Pinia）。SceneStack 通过 useSceneSet() 取当前组，
 * 顶栏 SceneSetMenu 通过它读选项与切换。
 *
 * 与 paletteStore 同一套写法：写坏的值一律回落到默认，
 * 并把浏览器里的废弃值顺手规整掉（用户口径：不留废值）。
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue'

import { DEFAULT_SCENE_SET, SCENE_SETS, type SceneSet } from '@/v2/theme/sceneState'

const STORAGE_KEY = 'vk-scene-set'

export interface SceneSetOption {
  set: SceneSet
  label: string
  hint: string
}

/** 选项文案（用户 2026-10-13 指定 gpt-image-2 那套为默认） */
const OPTIONS: SceneSetOption[] = [
  { set: 'gpt', label: '细节写实（gpt-image-2）', hint: '层次多、元素密，天际线细节丰富' },
  { set: 'seedream', label: '柔和绘本（seedream）', hint: '笔触柔和、天空留白多，偏治愈绘本感' },
]

function loadSet(): SceneSet {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (SCENE_SETS.includes(v as SceneSet))
      return v as SceneSet
    // 无效/废弃的值顺手规整掉，别让废值长期留在浏览器里
    if (v !== null)
      localStorage.setItem(STORAGE_KEY, DEFAULT_SCENE_SET)
    return DEFAULT_SCENE_SET
  }
  catch {
    return DEFAULT_SCENE_SET
  }
}

const set = ref<SceneSet>(loadSet())

export function setSceneSet(next: SceneSet): void {
  set.value = SCENE_SETS.includes(next) ? next : DEFAULT_SCENE_SET
  try {
    localStorage.setItem(STORAGE_KEY, set.value)
  }
  catch {
    // 隐私模式下 localStorage 不可写：状态仍在内存里生效，不抛错
  }
}

export function useSceneSet(): {
  set: Ref<SceneSet>
  options: SceneSetOption[]
  current: ComputedRef<SceneSetOption>
  setSceneSet: (next: SceneSet) => void
} {
  return {
    set,
    options: OPTIONS,
    current: computed(() => OPTIONS.find((o) => o.set === set.value) ?? OPTIONS[0]!),
    setSceneSet,
  }
}
