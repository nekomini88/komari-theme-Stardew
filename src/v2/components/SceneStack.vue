<script setup lang="ts">
/**
 * SceneStack —— 整幅场景背景（季节 × 时段，两套素材可切换）
 *
 * 口径（用户 2026-10-13）：
 *  - 场景 = **季节 × 时段** 共 12 张整幅插画（用户出的农场 12 景），按服务端世界时间选图；
 *  - 素材分**两套**：gpt-image-2（默认）与 seedream，由顶栏「场景」按钮切换（sceneStore）；
 *  - 光照已烘在图里 → 不做整栈 tint、不分层，时段/季节只决定选哪张图；
 *  - 时间来源 = 服务端世界时钟（@/utils/serverClock，UTC+8），**不跟访客本地时钟**。
 *
 * 素材：public/images/v2-scene/<组>/<季节>_<时段>.webp
 *      gpt 1672×941 / seedream 1920×1080，WebP q=88，单张 175~351KB（单测有 ≤400KB 闸门）。
 *
 * 交叉淡化挂在「最终 URL」上：换时段、换季节、换素材组都会触发同一套 1.2s 淡入淡出。
 */
import type { SceneSet, Season, TimeOfDay, Weather } from '@/v2/theme/sceneState'
import { computed } from 'vue'
import { useCrossfade } from '@/v2/theme/useCrossfade'
import { sceneUrlFor } from '@/v2/theme/sceneState'

const props = withDefaults(defineProps<{
  /** 时段（由服务端世界时钟解析，见 App.vue） */
  time?: TimeOfDay
  /** 季节（服务端月份解析，或主题配置项固定） */
  season?: Season
  /** 天气（本期只支持晴；只保留入参） */
  weather?: Weather
  /** 素材组（顶栏「场景」按钮切换，见 sceneStore） */
  set?: SceneSet
}>(), {
  time: 'day',
  season: 'summer',
  weather: 'clear',
  set: 'gpt',
})

/** 12 张 × 2 套素材齐全，无需回退表；缺图由单测当场抓出来（见 v2-scene-set.test.ts） */
const url = computed(() => sceneUrlFor(props.set, props.season, props.time))

/** 换图统一走 1.2s 交叉淡化（禁止硬切，沿用 ART_SYSTEM 的过渡口径） */
const fade = useCrossfade(url)

defineExpose({ isTransitioning: fade.isTransitioning })
</script>

<template>
  <div
    class="vk-scene"
    :data-time="time"
    :data-season="season"
    :data-set="set"
    data-arch="full-bleed"
    :data-transitioning="fade.isTransitioning.value"
  >
    <!-- 退场层：仅过渡期间存在，压在进入层之下 -->
    <div
      v-if="fade.leaving.value"
      class="vk-scene-plate"
      data-role="leave"
      :style="{ backgroundImage: `url(${fade.leaving.value})` }"
    />

    <!-- 进入层：key 绑定 URL，换图时重放淡入动画 → 与退场层构成交叉淡化 -->
    <div
      :key="fade.current.value"
      class="vk-scene-plate"
      data-role="enter"
      :style="{ backgroundImage: `url(${fade.current.value})` }"
    />
  </div>
</template>
