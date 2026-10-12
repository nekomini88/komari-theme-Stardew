<script setup lang="ts">
/**
 * SceneDecor —— 场景关键素材层（太阳 / 云 / 层叠丘陵 / 风车 / 房屋 / 灌木 / 小路）。
 *
 * 口径（用户明确要求）：场景装饰美术**一律使用 ListenHub 生成的透明 PNG 插画**
 * （`/images/v2-scene/*.png`），代码只负责摆放 / 缩放 / 显隐，**不得内联 SVG/CSS 手搓图形**。
 *
 * 挂在 SceneStack 的 `.vk-scene`(z-index 0) 之内 —— 永远位于卡片内容层 `.vk-main`(z-index 1) 之下，
 * 故不会遮挡任何卡片数据；`pointer-events: none` 保证不吃点击。
 *
 * 显隐：
 *  - 太阳 / 云：昼间（day / dusk）显示，夜间隐藏 → 露出夜色插画自带的月亮与星空。
 *  - 丘陵 / 风车 / 房屋 / 灌木 / 小路：始终显示（属地面景观，夜景里仍可辨认）。
 */
import type { TimeOfDay } from '@/v2/theme/sceneState'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  time?: TimeOfDay
}>(), {
  time: 'day',
})

/** 太阳 / 云只在白天与黄昏出现 */
const showSky = computed(() => props.time !== 'night')

/** 素材契约：名称 → 仓库内路径（单测按此表校验文件真实存在） */
const DECOR_SRC = {
  sun: '/images/v2-scene/sun-smile.png',
  cloud: '/images/v2-scene/cloud-puff.png',
  hills: '/images/v2-scene/hills-layer.png',
  windmill: '/images/v2-scene/windmill.png',
  house: '/images/v2-scene/house.png',
  bush: '/images/v2-scene/bush.png',
  path: '/images/v2-scene/path.png',
} as const
</script>

<template>
  <div class="vk-decor" data-decor="scene" aria-hidden="true">
    <!-- ============ 天空：带笑脸光芒的太阳（左上）============ -->
    <img
      v-if="showSky"
      class="vk-decor-sun"
      data-decor-part="sun"
      :src="DECOR_SRC.sun"
      alt=""
      draggable="false"
    >

    <!-- ============ 天空：蓬松白云（三朵散布）============ -->
    <template v-if="showSky">
      <img
        v-for="i in 3"
        :key="`cloud-${i}`"
        class="vk-decor-cloud"
        :class="`vk-decor-cloud-${i}`"
        data-decor-part="cloud"
        :src="DECOR_SRC.cloud"
        alt=""
        draggable="false"
      >
    </template>

    <!-- ============ 层叠丘陵：两层做纵深（远层淡 → 近层实）============ -->
    <img
      class="vk-decor-hills vk-decor-hills-back"
      data-decor-part="hills-back"
      :src="DECOR_SRC.hills"
      alt=""
      draggable="false"
    >
    <img
      class="vk-decor-hills vk-decor-hills-front"
      data-decor-part="hills-front"
      :src="DECOR_SRC.hills"
      alt=""
      draggable="false"
    >

    <!-- ============ 地平线带：风车 / 房屋 / 灌木（卡片网格上方的露出区）============ -->
    <img
      class="vk-decor-building vk-decor-windmill"
      data-decor-part="windmill"
      :src="DECOR_SRC.windmill"
      alt=""
      draggable="false"
    >
    <img
      class="vk-decor-building vk-decor-house"
      data-decor-part="house"
      :src="DECOR_SRC.house"
      alt=""
      draggable="false"
    >
    <img
      class="vk-decor-building vk-decor-bush"
      data-decor-part="bush"
      :src="DECOR_SRC.bush"
      alt=""
      draggable="false"
    >

    <!-- ============ 小路：自底部向远处延伸（居中，向上收窄淡出）============ -->
    <img
      class="vk-decor-path"
      data-decor-part="path"
      :src="DECOR_SRC.path"
      alt=""
      draggable="false"
    >
  </div>
</template>
