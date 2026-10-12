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
import SceneLife from '@/v2/components/SceneLife.vue'

const props = withDefaults(defineProps<{
  time?: TimeOfDay
  season?: Season
  /** 彩蛋取证开关：把一只动物钉在画面里（截图/探针用），默认不计 */
  forceLife?: boolean
}>(), {
  time: 'day',
  season: 'summer',
  forceLife: false,
})

const scene = computed(() => resolveScene(props.time, props.season))

/** 内容层（sky 单独渲染色带，不参与视差层循环） */
const contentLayers = computed(() => scene.value.layers.filter(l => l.id !== 'sky'))

/** 交叉淡化：时间 tint 与季节 tint 各一套，场景底图单独一套 */
const timeFade = useCrossfade(computed(() => scene.value.timeTint), TRANSITION_MS)
const seasonFade = useCrossfade(computed(() => scene.value.seasonTint), TRANSITION_MS)
const bgFade = useCrossfade(computed(() => scene.value.backgroundUrl), TRANSITION_MS)

const isTransitioning = computed(
  () => timeFade.isTransitioning.value || seasonFade.isTransitioning.value || bgFade.isTransitioning.value,
)

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

/** 场景底图：整幅插画铺满（cover + 顶部对齐），由 opacity 过渡做交叉淡化 */
function bgStyle(url: string | null) {
  return {
    backgroundImage: url ? `url('${url}')` : 'none',
    transitionDuration: `${TRANSITION_MS}ms`,
  }
}

/** 天空色带：每段从自己的色平滑过渡到下一段，四段拼出无硬缝的整片渐变天空 */
function bandStyle(i: number) {
  const bands = scene.value.skyBands
  const c0 = bands[i]!
  const c1 = bands[i + 1] ?? c0
  return {
    background: `linear-gradient(180deg, ${c0} 0%, ${c1} 100%)`,
    top: `${i * 25}%`,
  }
}

defineExpose({
  scene,
  isTransitioning,
  currentTint: timeFade.current,
  leavingTint: timeFade.leaving,
  currentSeasonTint: seasonFade.current,
  leavingSeasonTint: seasonFade.leaving,
  currentBgUrl: bgFade.current,
  leavingBgUrl: bgFade.leaving,
})
</script>

<template>
  <div class="vk-scene" :data-time="scene.time" :data-season="scene.season" :data-transitioning="isTransitioning">
    <!-- 场景底图：整幅手绘插画，按访客本地时间交叉淡化（离开层在下、进入层在上） -->
    <div
      v-if="bgFade.leaving.value"
      class="vk-scene-bg"
      data-bg="leave"
      :style="bgStyle(bgFade.leaving.value)"
    />
    <div
      :key="bgFade.current.value"
      class="vk-scene-bg"
      data-bg="enter"
      :style="bgStyle(bgFade.current.value)"
    />
    <!-- 天空：4 段色带（夜间/兜底）+ 手绘天空插画（昼间叠加，云在山影之上） -->
    <div class="vk-sky" data-layer="sky">
      <div
        v-for="(band, i) in scene.skyBands"
        :key="`band-${i}`"
        class="vk-sky-band"
        :style="bandStyle(i)"
      />
      <!-- 手绘天空插画：昼/昏显示（自带云与地平线奶白过渡）；夜隐藏 → 露出色带夜空。
           tint 仍是整栈叠加层（见下方 .vk-tint），与天空色带/各层无关地统一生效。 -->
      <span class="vk-sky-img" />
      <!-- 太阳（左上，带光芒）/ 云（柔边白云）—— 田园场景要素 -->
      <span class="vk-sun" />
      <span class="vk-cloud vk-cloud-1" />
      <span class="vk-cloud vk-cloud-2" />
      <span class="vk-cloud vk-cloud-3" />
    </div>

    <!-- 视差层：far / mid / near / ground（背景由 scene.css 按时间着色） -->
    <div
      v-for="layer in contentLayers"
      :key="layer.id"
      class="vk-layer"
      :data-layer="layer.id"
      :data-parallax="layer.parallax"
      :style="layerStyle(layer.parallax)"
    >
      <span class="vk-layer-base" />
      <slot :name="layer.id" />
      <!-- 生态层（植物生长循环 + 动物彩蛋）：仅在共享地面基线层内，随季节播种、确定性摆放 -->
      <SceneLife
        v-if="layer.id === 'ground'"
        :time="scene.time"
        :season="scene.season"
        :force="forceLife"
      />
    </div>

    <!-- 整栈 tint：进入层（始终存在） -->
    <div class="vk-tint" data-tint="time-enter" :style="tintStyle(timeFade.current.value)" />
    <div class="vk-tint" data-tint="season-enter" :style="tintStyle(seasonFade.current.value)" />
    <!-- 整栈 tint：离开层（仅在过渡期间存在 → 交叉淡化而非硬切） -->
    <div v-if="timeFade.leaving.value" class="vk-tint" data-tint="time-leave" :style="tintStyle(timeFade.leaving.value)" />
    <div v-if="seasonFade.leaving.value" class="vk-tint" data-tint="season-leave" :style="tintStyle(seasonFade.leaving.value)" />
  </div>
</template>
