<script setup lang="ts">
/**
 * SceneStack —— 五层场景图层栈（ART_SYSTEM.md §2）
 *
 * - 单一状态源：props.time × props.season
 * - 五层结构：sky / far(0.2) / mid(0.5) / near(0.8) / ground(1.0)
 * - 场景覆盖整份文档高度（随内容自适应），故卡片网格/长列表滚动时场景始终在背后，不留空白带
 * - 变化 = 整栈套 tint + 换天空色带；时间 tint 与季节 tint 各自 1.2s 交叉淡化
 * - 所有角色/建筑共享 ground 基线（本组件把 ground 层暴露为具名插槽）
 */
import type { Season, TimeOfDay, TintSpec } from '@/v2/theme/sceneState'
import { computed } from 'vue'
import { resolveScene, TRANSITION_MS } from '@/v2/theme/sceneState'
import { useCrossfade } from '@/v2/theme/useCrossfade'

const props = withDefaults(defineProps<{ time?: TimeOfDay, season?: Season }>(), {
  time: 'day',
  season: 'summer',
})

const scene = computed(() => resolveScene(props.time, props.season))

/** 内容层（sky 单独渲染色带，不参与视差层循环） */
const contentLayers = computed(() => scene.value.layers.filter(l => l.id !== 'sky'))

/** 交叉淡化：时间 tint 与季节 tint 各一套 */
const timeFade = useCrossfade(computed(() => scene.value.timeTint), TRANSITION_MS)
const seasonFade = useCrossfade(computed(() => scene.value.seasonTint), TRANSITION_MS)

const isTransitioning = computed(() => timeFade.isTransitioning.value || seasonFade.isTransitioning.value)

function layerStyle(parallax: number) {
  return {
    '--vk-layer-parallax': String(parallax),
    'zIndex': String(SCENE_Z[parallax] ?? 0),
  }
}
// 视差系数 → z 序（保持图层叠放次序）
const SCENE_Z: Record<number, number> = { 0: 0, 0.2: 1, 0.5: 2, 0.8: 3, 1: 4 }

function tintStyle(t: TintSpec | null) {
  return {
    background: t?.color ?? 'transparent',
    opacity: String(t?.opacity ?? 0),
    transitionDuration: `${TRANSITION_MS}ms`,
  }
}

defineExpose({
  scene,
  isTransitioning,
  currentTint: timeFade.current,
  leavingTint: timeFade.leaving,
  currentSeasonTint: seasonFade.current,
  leavingSeasonTint: seasonFade.leaving,
})
</script>

<template>
  <div class="vk-scene" :data-time="scene.time" :data-season="scene.season" :data-transitioning="isTransitioning">
    <!-- 天空：4 段色带（非 CSS 渐变） -->
    <div class="vk-sky" data-layer="sky">
      <div
        v-for="(band, i) in scene.skyBands"
        :key="`band-${i}`"
        class="vk-sky-band"
        :style="{ background: band, top: `${i * 25}%` }"
      />
    </div>

    <!-- 视差层：far / mid / near / ground -->
    <div
      v-for="layer in contentLayers"
      :key="layer.id"
      class="vk-layer"
      :data-layer="layer.id"
      :data-parallax="layer.parallax"
      :style="layerStyle(layer.parallax)"
    >
      <span class="vk-layer-base" :style="{ background: scene.layerColors[layer.id as 'far' | 'mid' | 'near' | 'ground'] }" />
      <slot :name="layer.id" />
    </div>

    <!-- 整栈 tint：进入层（始终存在） -->
    <div class="vk-tint" data-tint="time-enter" :style="tintStyle(timeFade.current.value)" />
    <div class="vk-tint" data-tint="season-enter" :style="tintStyle(seasonFade.current.value)" />
    <!-- 整栈 tint：离开层（仅在过渡期间存在 → 交叉淡化而非硬切） -->
    <div v-if="timeFade.leaving.value" class="vk-tint" data-tint="time-leave" :style="tintStyle(timeFade.leaving.value)" />
    <div v-if="seasonFade.leaving.value" class="vk-tint" data-tint="season-leave" :style="tintStyle(seasonFade.leaving.value)" />
  </div>
</template>
