<script setup lang="ts">
/**
 * SceneDecor —— 场景装饰层（一律为 ListenHub 生成的透明 PNG 插画，代码只摆放/缩放/显隐）。
 *
 * 常驻：带笑脸的太阳 / 蓬松云 / 层叠丘陵(两层) / 风车 / 房屋 / 灌木 / 小路 / 前景栅栏 / 前景花丛
 * 昼夜：夜 → 月亮星空 + 亮窗房屋（太阳/云隐藏）
 * 季节：春 → 樱花树 + 春花丛；秋 → 南瓜 + 干草垛 + 飘落枫叶；冬 → 雪树 + 积雪丘
 * 侧树：昼 → 左右各一棵独立树（参考稿白天两侧的树）；冬 → 换雪树
 * 夜间：萤火虫（参考稿夜景里栅栏边的暖黄光点）
 * 天气（§2.3）：雨 / 雪 / 风 / 雾 —— 全部由 PNG 精灵 + CSS 动画摆放，不手搓图形
 *
 * 挂在 SceneStack 的 `.vk-scene`(z-index 0) 之内 → 永远位于卡片层 `.vk-main`(z-index 1) 之下。
 */
import type { Season, TimeOfDay, Weather } from '@/v2/theme/sceneState'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  time?: TimeOfDay
  season?: Season
  weather?: Weather
}>(), {
  time: 'day',
  season: 'summer',
  weather: 'clear',
})

const showSky = computed(() => props.time !== 'night')
const isNight = computed(() => props.time === 'night')
const isSpring = computed(() => props.season === 'spring')
const isAutumn = computed(() => props.season === 'autumn')
const isWinter = computed(() => props.season === 'winter')
const isRain = computed(() => props.weather === 'rain')
const isSnow = computed(() => props.weather === 'snow')
const isFog = computed(() => props.weather === 'fog')
const isWind = computed(() => props.weather === 'wind')

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
  tree: '/images/v2-scene/day-tree.png',
  snowTree: '/images/v2-scene/winter-snow-tree.png',
  snowPatch: '/images/v2-scene/winter-snow-patch.png',
  pumpkins: '/images/v2-scene/autumn-pumpkins.png',
  haybale: '/images/v2-scene/autumn-haybale.png',
  leaf: '/images/v2-scene/autumn-leaf.png',
  firefly: '/images/v2-scene/night-firefly.png',
  raindrop: '/images/v2-scene/weather-raindrop.png',
  snowflake: '/images/v2-scene/weather-snowflake.png',
  fog: '/images/v2-scene/weather-fog.png',
} as const

/** 天气精灵的逐实例参数（位置/相位/缩放）——确定性，不用随机数 */
function dropStyle(i: number, total: number, dur: number) {
  return {
    '--vk-wx': `${((i * 137) % 1000) / 10}%`,
    '--vk-delay': `${-((i * 0.37) % dur).toFixed(2)}s`,
    '--vk-dur': `${dur}s`,
    '--vk-scale': `${(0.7 + ((i * 23) % 70) / 100).toFixed(2)}`,
  }
}
function floatStyle(i: number, dur: number) {
  return {
    '--vk-fx': `${6 + ((i * 211) % 880) / 10}`,
    '--vk-fy': `${18 + ((i * 97) % 620) / 10}`,
    '--vk-delay': `${-((i * 0.53) % dur).toFixed(2)}s`,
    '--vk-dur': `${dur}s`,
  }
}
</script>

<template>
  <div
    class="vk-decor"
    data-decor="scene"
    :data-weather="weather"
    :class="{ 'vk-decor-windy': isWind }"
    aria-hidden="true"
  >
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

    <!-- ============ 地平线带：左右两棵独立树（参考稿白天两侧的树）；冬换雪树 ============ -->
    <img
      class="vk-decor-building vk-decor-tree-left"
      :data-decor-part="isWinter ? 'snow-tree-left' : 'tree-left'"
      :src="isWinter ? DECOR_SRC.snowTree : DECOR_SRC.tree"
      alt=""
      draggable="false"
    >
    <img
      class="vk-decor-building vk-decor-tree-right"
      :data-decor-part="isWinter ? 'snow-tree-right' : 'tree-right'"
      :src="isWinter ? DECOR_SRC.snowTree : DECOR_SRC.tree"
      alt=""
      draggable="false"
    >

    <!-- ============ 季节：春（樱花树 + 春花丛）/ 秋（南瓜 + 干草垛）/ 冬（积雪丘）============ -->
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
    <template v-if="isAutumn">
      <img
        class="vk-decor-building vk-decor-pumpkins"
        data-decor-part="autumn-pumpkins"
        :src="DECOR_SRC.pumpkins"
        alt=""
        draggable="false"
      >
      <img
        class="vk-decor-building vk-decor-haybale"
        data-decor-part="autumn-haybale"
        :src="DECOR_SRC.haybale"
        alt=""
        draggable="false"
      >
      <!-- 飘落的枫叶：4 片，仅用 ListenHub 的枫叶 PNG + CSS 缓降 -->
      <img
        v-for="i in 4"
        :key="`leaf-${i}`"
        class="vk-decor-leaf"
        :style="floatStyle(i, 7)"
        data-decor-part="autumn-leaf"
        :src="DECOR_SRC.leaf"
        alt=""
        draggable="false"
      >
    </template>
    <template v-if="isWinter">
      <img
        class="vk-decor-snowpatch vk-decor-snowpatch-1"
        data-decor-part="winter-snow-patch"
        :src="DECOR_SRC.snowPatch"
        alt=""
        draggable="false"
      >
      <img
        class="vk-decor-snowpatch vk-decor-snowpatch-2"
        data-decor-part="winter-snow-patch"
        :src="DECOR_SRC.snowPatch"
        alt=""
        draggable="false"
      >
    </template>

    <!-- ============ 夜间：萤火虫（栅栏边的暖黄光点）============ -->
    <template v-if="isNight">
      <img
        v-for="i in 5"
        :key="`firefly-${i}`"
        class="vk-decor-firefly"
        :style="floatStyle(i, 5)"
        data-decor-part="firefly"
        :src="DECOR_SRC.firefly"
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

    <!-- ============ 前景框景：木栅栏横带 + 底部花丛带 ============ -->
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

    <!-- ============ 天气（§2.3）：雨 / 雪 / 雾 —— ListenHub 精灵 + CSS 动画 ============ -->
    <div class="vk-weather" data-weather-layer>
      <template v-if="isRain">
        <img
          v-for="i in 14"
          :key="`rain-${i}`"
          class="vk-weather-drop"
          :style="dropStyle(i, 14, 1.05)"
          data-decor-part="weather-rain"
          :src="DECOR_SRC.raindrop"
          alt=""
          draggable="false"
        >
      </template>
      <template v-if="isSnow">
        <img
          v-for="i in 16"
          :key="`snow-${i}`"
          class="vk-weather-flake"
          :style="dropStyle(i, 16, 9)"
          data-decor-part="weather-snow"
          :src="DECOR_SRC.snowflake"
          alt=""
          draggable="false"
        >
      </template>
      <img
        v-if="isFog"
        class="vk-weather-fog"
        data-decor-part="weather-fog"
        :src="DECOR_SRC.fog"
        alt=""
        draggable="false"
      >
    </div>
  </div>
</template>
