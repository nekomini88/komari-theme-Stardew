/**
 * useCrossfade —— 把「值切换」变成「交叉淡化」的通用工具。
 *
 * ART_SYSTEM.md §2：状态切换用 1.2s 交叉淡化，禁止硬切。
 * 做法：保留正在退场的旧值，让新值与旧值同时存在，由 CSS 过渡做 opacity 交叉淡化，
 * 过渡结束后清除旧值。因此组件里会同时渲染「进入」与「离开」两层。
 */
import type { Ref } from 'vue'
import { onUnmounted, ref, watch } from 'vue'
import { TRANSITION_MS } from './sceneState'

export interface Crossfade<T> {
  /** 当前生效值 */
  current: Ref<T>
  /** 正在退场的旧值（过渡期间非空） */
  leaving: Ref<T | null>
  /** 是否处于过渡中 */
  isTransitioning: Ref<boolean>
  /** 过渡时长（ms），即 CSS transition-duration 应使用的值 */
  duration: number
}

export function useCrossfade<T>(source: Ref<T>, duration: number = TRANSITION_MS): Crossfade<T> {
  const current = ref(source.value) as Ref<T>
  const leaving = ref<T | null>(null) as Ref<T | null>
  const isTransitioning = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  watch(source, (next) => {
    leaving.value = current.value
    current.value = next
    isTransitioning.value = true
    if (timer)
      clearTimeout(timer)
    timer = setTimeout(() => {
      leaving.value = null
      isTransitioning.value = false
      timer = null
    }, duration)
  })

  onUnmounted(() => {
    if (timer)
      clearTimeout(timer)
  })

  return { current, leaving, isTransitioning, duration }
}
