<script setup lang="ts">
/**
 * SceneDecor —— 场景关键素材层（太阳 / 云 / 层叠丘陵 / 风车 / 房屋 / 灌木 / 小路 /
 *                              前景栅栏与花丛 / 月亮星空 / 春季花木）。
 *
 * 口径（用户明确要求）：场景装饰美术**一律使用 ListenHub 生成的透明 PNG 插画**
 * （`/images/v2-scene/*.png`），代码只负责摆放 / 缩放 / 显隐，**不得内联 SVG/CSS 手搓图形**。
 *
 * 挂在 SceneStack 的 `.vk-scene`(z-index 0) 之内 —— 永远位于卡片内容层 `.vk-main`(z-index 1) 之下，
 * 故不会遮挡任何卡片数据；`pointer-events: none` 保证不吃点击。
 *
 * 显隐：
 *  - 昼（day/dusk）：太阳 + 三朵云；夜：隐藏 → 换「月亮 + 星星」+ 亮窗房屋。
 *  - 春：加一棵樱花树 + 一丛春花（P2-7 季节专属）。
 *  - 前景栅栏 / 前景花丛：始终显示，构成参考稿的「框景」。
 */
import type { Season, TimeOfDay } from '@/v2/theme/sceneState'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  time?: TimeOfDay
  season?: Season
}>(), {
  time: 'day',
  season: 'summer',
})

/** 太阳 / 云只在白天与黄昏出现 */
const showSky = computed(() => props.time !== 'night')
/** 夜间：月亮星空 + 亮窗房屋 */
const isNight = computed(() => props.time === 'night')
/** 春季专属花木 */
const isSpring = computed(() => props.season === 'spring')

/** 素材契约：名称 → 仓库内路径（单测按此表校验文件真实存在） */
const DECOR_SRC = {
  sun: '/images/v2-scene/sun-smile.png',
  cloud: '/images/v2-scene/cloud-puff.png',
  hills: '/images/v2-scene/hills-layer.png',
  windmill: '/images/v2-scene/windmill.png',
  house: '/images/v2-scene/house.png',
  houseNight: '/images/v2-scene/house-night.png',
  bush: '/images/v2-scene/bush.png',
  path: '/images/v2-scene/path.png',
  fence: '/images/v2-scene/fence-foreground.png',
  flowerbed: '/images/v2-scene/flowerbed-foreground.png',
  moonStars: '/images/v2-scene/moon-stars.png',
  blossom: '/images/v2-scene/spring-blossom.png',
  springFlowers: '/images/v2-scene/spring-flowers.png',
} as const
</script>

<template>
  <div class="vk-decor" data-decor="scene" aria-hidden="true">
    <!-- ============ 天空：带笑脸光芒的太阳（左上）/ 夜间的月亮与星星 ============ -->
    <img
      v-if="showSky"
      class="vk-decor-sun"
      data-decor-part="sun"
      :src="DECOR_SRC.sun"
      alt=""
      draggable="false"
    >
    <img
      v-else
      class="vk-decor-moon"
      data-decor-part="moon-stars"
      :src="DECOR_SRC.moonStars"
      alt=""
      draggable="false"
    >

    <!-- ============ 天空：蓬松白云（三朵散布，昼间）============ -->
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

    <!-- ============ 地平线带：风车 / 房屋（夜间换亮窗版）/ 灌木 ============ -->
    <img
      class="vk-decor-building vk-decor-windmill"
      data-decor-part="windmill"
      :src="DECOR_SRC.windmill"
      alt=""
      draggable="false"
    >
    <img
      class="vk-decor-building vk-decor-house"
      :data-decor-part="isNight ? 'house-night' : 'house'"
      :src="isNight ? DECOR_SRC.houseNight : DECOR_SRC.house"
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

    <!-- ============ 春季专属：樱花树 + 春花丛（P2-7）============ -->
    <template v-if="isSpring">
      <img
        class="vk-decor-building vk-decor-blossom"
        data-decor-part="spring-blossom"
        :src="DECOR_SRC.blossom"
        alt=""
        draggable="false"
      >
      <img
        class="vk-decor-building vk-decor-spring-flowers"
        data-decor-part="spring-flowers"
        :src="DECOR_SRC.springFlowers"
        alt=""
        draggable="false"
      >
    </template>

    <!-- ============ 小路：自地平线向下延伸（居中，向上淡出）============ -->
    <img
      class="vk-decor-path"
      data-decor-part="path"
      :src="DECOR_SRC.path"
      alt=""
      draggable="false"
    >

    <!-- ============ 前景框景：木栅栏横带（贴卡片网格上沿）+ 底部花丛带 ============ -->
    <img
      class="vk-decor-fence"
      data-decor-part="fence"
      :src="DECOR_SRC.fence"
      alt=""
      draggable="false"
    >
    <img
      class="vk-decor-flowerbed"
      data-decor-part="flowerbed"
      :src="DECOR_SRC.flowerbed"
      alt=""
      draggable="false"
    >
  </div>
</template>
