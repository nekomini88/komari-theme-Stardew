<script setup lang="ts">
/**
 * SceneStack —— 整幅场景背景（像素风 · 复刻《星露谷物语主题.pdf》）
 *
 * 口径（用户 2026-10-12 定）：
 *  - 「不用切画面」→ 场景**不再分层拼接**，直接用 ListenHub 生成的**整幅像素风插画**当背景
 *  - 光照已烘焙在图里 → **不做整栈 tint**，时间档直接选图
 *  - 时间来源 = 服务端世界时钟（@/utils/serverClock，UTC+8），**不跟访客本地时钟**
 *  - 四季系统 / 雷电天气：用户明确「后期再做」，此组件不涉
 *
 * 素材：public/images/v2-scene/full/{day,dusk,night}.png（ListenHub Nano Banana Pro 生成，
 *      原图 2752×1536，进仓前降到 1920×1072 + 256 色量化，平均色差 <2/255）
 */
import type { Season, TimeOfDay, Weather } from '@/v2/theme/sceneState'
import { computed } from 'vue'
import { useCrossfade } from '@/v2/theme/useCrossfade'

const props = withDefaults(defineProps<{
  /** 时段（由服务端世界时钟解析，见 App.vue） */
  time?: TimeOfDay
  /** 季节（本期「先不做」，保留入参以免上层调用点作废） */
  season?: Season
  /** 天气（本期只支持晴；只保留入参） */
  weather?: Weather
}>(), {
  time: 'day',
  season: 'summer',
  weather: 'clear',
})

const SCENE_DIR = '/images/v2-scene/full'

/** 已出图的时段。**night 出图后加进来即可**，其余代码无需改动。
 *  未出图的时段回退到最近可用的时段，避免 404 破图。 */
const AVAILABLE: readonly TimeOfDay[] = ['day', 'dusk', 'night']
const FALLBACK_TIME: TimeOfDay = 'dusk'

/** 实际渲染用时段：请求的时段没图时回退 */
const effectiveTime = computed<TimeOfDay>(() =>
  AVAILABLE.includes(props.time) ? props.time : FALLBACK_TIME)

function sceneUrl(t: TimeOfDay): string {
  return `${SCENE_DIR}/${t}.png`
}

/** 时段切换 → 1.2s 交叉淡化（禁止硬切，沿用 ART_SYSTEM 的过渡口径） */
const fade = useCrossfade(effectiveTime)

defineExpose({ effectiveTime, isTransitioning: fade.isTransitioning })
</script>

<template>
  <div class="vk-scene" :data-time="effectiveTime" data-arch="full-bleed" :data-transitioning="fade.isTransitioning.value">
    <!-- 退场层：仅过渡期间存在，压在进入层之下 -->
    <div
      v-if="fade.leaving.value"
      class="vk-scene-plate"
      data-role="leave"
      :style="{ backgroundImage: `url(${sceneUrl(fade.leaving.value)})` }"
    />
    <!-- 进入层：key 绑定 URL，换图时重放淡入动画 → 与退场层构成交叉淡化 -->
    <div
      :key="sceneUrl(fade.current.value)"
      class="vk-scene-plate"
      data-role="enter"
      :style="{ backgroundImage: `url(${sceneUrl(fade.current.value)})` }"
    />
  </div>
</template>
