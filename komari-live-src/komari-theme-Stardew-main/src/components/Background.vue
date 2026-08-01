<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import {
  isFog,
  isNight,
  isRain,
  isSnow,
  isThunder,
  moonX,
  moonY,
  season,
  sunX,
  sunY,
  timeOfDay,
  weather,
} from '@/composables/useStardewAtmosphere'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

const isLoaded = ref(false)
const hasError = ref(false)

const showBackground = computed(() => appStore.backgroundEnabled)
const currentUrl = computed(() => appStore.currentBackgroundUrl)
const backgroundType = computed(() => appStore.backgroundType)
const hasCustomBackground = computed(() => showBackground.value && !!currentUrl.value)
const showBackgroundOverlay = computed(() => hasCustomBackground.value && appStore.backgroundOverlay > 0)

const backgroundStyle = computed(() => {
  const blur = appStore.backgroundBlur
  return {
    filter: blur > 0 ? `blur(${blur}px)` : 'none',
    opacity: appStore.backgroundType === 'video' && !isLoaded.value ? 0 : 1,
  }
})

const backgroundContainerStyle = computed(() => {
  if (!hasCustomBackground.value)
    return {}
  const overlay = appStore.backgroundOverlay
  if (overlay >= 0)
    return {}
  return { opacity: 1 - Math.abs(overlay) / 100 }
})

const overlayStyle = computed(() => {
  const overlay = appStore.backgroundOverlay
  if (overlay <= 0)
    return {}
  return { backgroundColor: `rgba(0, 0, 0, ${overlay / 100})` }
})

const showLoadedBackground = computed(() =>
  hasCustomBackground.value && isLoaded.value && !hasError.value,
)
const showMediaBackground = computed(() =>
  hasCustomBackground.value && !hasError.value && (backgroundType.value === 'video' || showLoadedBackground.value),
)

const showStardewBackground = computed(() => true)

/** 轻量时间色调，不遮挡 bg-sky 细节 */
const timeTint = computed(() => {
  if (timeOfDay.value === 'dawn')
    return 'linear-gradient(180deg, rgba(255,180,120,0.16) 0%, transparent 55%)'
  if (timeOfDay.value === 'dusk')
    return 'linear-gradient(180deg, rgba(255,100,40,0.2) 0%, rgba(40,20,60,0.08) 100%)'
  if (timeOfDay.value === 'night')
    return 'linear-gradient(180deg, rgba(10,20,50,0.42) 0%, rgba(10,25,40,0.22) 100%)'
  if (season.value === 'autumn')
    return 'linear-gradient(180deg, rgba(255,180,60,0.08) 0%, transparent 60%)'
  if (season.value === 'winter')
    return 'linear-gradient(180deg, rgba(200,220,240,0.1) 0%, transparent 60%)'
  return 'transparent'
})

const sunStyle = computed(() => ({
  left: `${sunX.value}%`,
  top: `${Math.min(sunY.value, 36)}%`,
  opacity: isNight.value ? 0 : (timeOfDay.value === 'dusk' ? 0.85 : 0.95),
}))

const moonStyle = computed(() => ({
  left: `${moonX.value}%`,
  top: `${moonY.value}%`,
  opacity: isNight.value ? 0.9 : 0,
}))

const showSun = computed(() => !isNight.value)
const showMoon = computed(() => isNight.value)
const showStars = computed(() => isNight.value)
const seasonAccentClass = computed(() => `season-${season.value}`)

const showLoadingBackground = computed(() =>
  hasCustomBackground.value && !isLoaded.value && !hasError.value,
)
const showFallbackBackground = computed(() =>
  hasCustomBackground.value && hasError.value,
)

let imageLoader: HTMLImageElement | null = null

function clearImageLoader() {
  if (imageLoader) {
    imageLoader.onload = null
    imageLoader.onerror = null
    imageLoader = null
  }
}

function loadImage(url: string) {
  isLoaded.value = false
  hasError.value = false
  clearImageLoader()
  imageLoader = new Image()
  imageLoader.onload = () => { isLoaded.value = true; hasError.value = false }
  imageLoader.onerror = () => { isLoaded.value = false; hasError.value = true }
  imageLoader.src = url
}

const videoRef = ref<HTMLVideoElement | null>(null)
function handleVideoLoaded() { isLoaded.value = true; hasError.value = false }
function handleVideoError() { isLoaded.value = false; hasError.value = true }

watch([currentUrl, backgroundType], ([url, type]) => {
  if (url && type === 'image')
    loadImage(url)
  else if (url && type === 'video') {
    clearImageLoader()
    isLoaded.value = false
    hasError.value = false
  }
  else {
    clearImageLoader()
    isLoaded.value = false
    hasError.value = false
  }
}, { immediate: true })

onUnmounted(() => clearImageLoader())
</script>

<template>
  <div class="background-container" :style="backgroundContainerStyle">
    <!-- 主题核心：bg-sky.png 全屏铺满，绝不替换 -->
    <div
      v-if="showStardewBackground"
      class="stardew-scene"
      :class="[
        seasonAccentClass,
        `time-${timeOfDay}`,
        `weather-${weather}`,
        { 'is-night': isNight },
      ]"
    >
      <img
        class="stardew-bg-sky"
        src="/images/background/bg-sky.png"
        alt=""
        draggable="false"
      >

      <div class="stardew-time-tint" :style="{ background: timeTint }" />

      <div v-show="showSun" class="stardew-sun" :style="sunStyle" />
      <div v-show="showMoon" class="stardew-moon" :style="moonStyle" />
      <div v-if="showStars" class="stardew-stars" aria-hidden="true">
        <span
          v-for="n in 20"
          :key="n"
          class="star"
          :style="{
            left: ((n * 37) % 100) + '%',
            top: ((n * 23) % 40) + '%',
            animationDelay: (n * 0.15) + 's',
            width: (2 + (n % 3)) + 'px',
            height: (2 + (n % 3)) + 'px',
          }"
        />
      </div>

      <div class="stardew-clouds" :class="{ dense: isRain || isThunder || isFog }">
        <img class="cloud-img c1" src="/images/background/cloud-1-transparent.png" alt="">
        <img class="cloud-img c2" src="/images/background/cloud-2-transparent.png" alt="">
        <img class="cloud-img c3" src="/images/background/cloud-1-transparent.png" alt="">
      </div>

      <!-- PDF 风格装饰层：左右花树（不遮挡中心内容） -->
      <img class="stardew-side-tree stardew-side-tree--left" src="/images/bg/cherry-left.png" alt="" draggable="false">
      <img class="stardew-side-tree stardew-side-tree--right" src="/images/bg/cherry-right.png" alt="" draggable="false">

      <!-- 底部白栅栏（对齐 PDF 白天/春季截图） -->
      <div class="stardew-fence" aria-hidden="true">
        <svg viewBox="0 0 1200 72" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <g fill="#f5f0e6" stroke="#c4b89a" stroke-width="2">
            <rect x="20" y="8" width="12" height="56" rx="1"/>
            <rect x="70" y="8" width="12" height="56" rx="1"/>
            <rect x="120" y="8" width="12" height="56" rx="1"/>
            <rect x="170" y="8" width="12" height="56" rx="1"/>
            <rect x="220" y="8" width="12" height="56" rx="1"/>
            <rect x="270" y="8" width="12" height="56" rx="1"/>
            <rect x="320" y="8" width="12" height="56" rx="1"/>
            <rect x="370" y="8" width="12" height="56" rx="1"/>
            <rect x="420" y="8" width="12" height="56" rx="1"/>
            <rect x="470" y="8" width="12" height="56" rx="1"/>
            <rect x="520" y="8" width="12" height="56" rx="1"/>
            <rect x="570" y="8" width="12" height="56" rx="1"/>
            <rect x="620" y="8" width="12" height="56" rx="1"/>
            <rect x="670" y="8" width="12" height="56" rx="1"/>
            <rect x="720" y="8" width="12" height="56" rx="1"/>
            <rect x="770" y="8" width="12" height="56" rx="1"/>
            <rect x="820" y="8" width="12" height="56" rx="1"/>
            <rect x="870" y="8" width="12" height="56" rx="1"/>
            <rect x="920" y="8" width="12" height="56" rx="1"/>
            <rect x="970" y="8" width="12" height="56" rx="1"/>
            <rect x="1020" y="8" width="12" height="56" rx="1"/>
            <rect x="1070" y="8" width="12" height="56" rx="1"/>
            <rect x="1120" y="8" width="12" height="56" rx="1"/>
            <rect x="1170" y="8" width="12" height="56" rx="1"/>
            <rect x="10" y="22" width="1180" height="10" rx="2"/>
            <rect x="10" y="42" width="1180" height="10" rx="2"/>
          </g>
        </svg>
      </div>

      <!-- 季节花草 / 南瓜 / 雪堆（贴栅栏线） -->
      <div class="stardew-ground-decor" aria-hidden="true">
        <span v-for="i in 16" :key="'f'+i" class="ground-flora" :style="{ left: (i * 6.2 - 3) + '%' }" />
        <img class="ground-prop ground-prop--scarecrow" src="/images/card/scarecrow.png" alt="">
        <img class="ground-prop ground-prop--birdhouse" src="/images/card/birdhouse.png" alt="">
        <img class="ground-prop ground-prop--flower" src="/images/card/flower.png" alt="">
        <img class="ground-prop ground-prop--house" src="/images/card/house.png" alt="">
      </div>

      <div v-if="isRain" class="stardew-weather-rain" />
      <div v-if="isSnow" class="stardew-weather-snow" />
      <div v-if="isFog" class="stardew-weather-fog" />
      <div v-if="isThunder" class="stardew-weather-thunder" />
    </div>

    <Transition name="fade">
      <div v-if="showLoadingBackground" class="background-loading" />
    </Transition>
    <Transition name="fade">
      <div v-if="showFallbackBackground" class="background-loading" />
    </Transition>
    <Transition name="fade">
      <div v-if="showMediaBackground" class="background-media" :style="backgroundStyle">
        <div
          v-if="backgroundType === 'image'"
          class="background-image"
          :style="{ backgroundImage: `url(${currentUrl})` }"
        />
        <video
          v-else-if="backgroundType === 'video'"
          ref="videoRef"
          class="background-video"
          :src="currentUrl ?? undefined"
          autoplay
          loop
          muted
          preload="auto"
          playsinline
          @loadeddata="handleVideoLoaded"
          @canplay="handleVideoLoaded"
          @error="handleVideoError"
        />
      </div>
    </Transition>
    <div v-if="showBackgroundOverlay" class="background-overlay" :style="overlayStyle" />
  </div>
</template>

<style scoped>
.background-container {
  position: fixed;
  inset: 0;
  /* 必须 >= 0，否则会被 #app 不透明底色盖住 */
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.background-loading {
  position: absolute;
  inset: 0;
  background-color: transparent;
}

.background-media {
  position: absolute;
  inset: 0;
  transform: scale(1.05);
  transition: opacity 0.8s ease;
  z-index: 20;
}

.background-image {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.background-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.background-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 21;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.8s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.stardew-scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  image-rendering: pixelated;
}

/* ===== 核心：bg-sky.png 全视口铺满 ===== */
.stardew-bg-sky {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
  image-rendering: pixelated;
  pointer-events: none;
  user-select: none;
  z-index: 0;
  display: block;
}

.stardew-time-tint {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  transition: background 2.5s ease;
}

.stardew-sun {
  position: absolute;
  width: 56px;
  height: 56px;
  margin-left: -28px;
  margin-top: -28px;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 50%, #fff8d0 0%, #ffe27a 40%, rgba(255, 200, 80, 0.3) 65%, transparent 100%);
  box-shadow:
    0 0 24px 8px rgba(255, 226, 122, 0.45),
    0 0 48px 16px rgba(255, 200, 80, 0.18) !important;
  transition: left 2s ease, top 2s ease, opacity 1.5s ease;
  z-index: 3;
  pointer-events: none;
}

.time-dusk .stardew-sun {
  background: radial-gradient(circle at 50% 50%, #ffd59a 0%, #ff8c42 45%, rgba(255, 100, 40, 0.25) 70%, transparent 100%);
}

.stardew-moon {
  position: absolute;
  width: 44px;
  height: 44px;
  margin-left: -22px;
  margin-top: -22px;
  border-radius: 50%;
  background: #fdfbf0;
  box-shadow: inset -14px -10px 0 0 rgba(10, 20, 40, 0.38), 0 0 20px 6px rgba(200, 210, 255, 0.35) !important;
  transition: left 2s ease, top 2s ease, opacity 1.5s ease;
  z-index: 3;
  pointer-events: none;
}

.stardew-stars {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}
.stardew-stars .star {
  position: absolute;
  border-radius: 50%;
  background: #fffef5;
  box-shadow: 0 0 3px 1px rgba(255, 255, 220, 0.8) !important;
  animation: star-twinkle 2.6s ease-in-out infinite;
}

@keyframes star-twinkle {
  0%, 100% { opacity: 0.3; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.15); }
}

.stardew-clouds {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
}
.stardew-clouds .cloud-img {
  position: absolute;
  opacity: 0.65;
  animation: stardew-cloud 80s linear infinite;
  image-rendering: pixelated;
}
.stardew-clouds.dense .cloud-img {
  opacity: 0.85;
  filter: brightness(0.85) saturate(0.7);
}
.stardew-clouds .c1 { top: 8%; left: -15%; width: 200px; animation-duration: 85s; }
.stardew-clouds .c2 { top: 18%; left: -30%; width: 160px; animation-duration: 100s; animation-delay: -30s; }
.stardew-clouds .c3 { top: 5%; left: -50%; width: 220px; animation-duration: 120s; animation-delay: -50s; }
.is-night .stardew-clouds { opacity: 0.15; }

.stardew-weather-rain {
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
  background: repeating-linear-gradient(
    -14deg,
    transparent 0,
    transparent 7px,
    rgba(180, 210, 255, 0.28) 7px,
    rgba(180, 210, 255, 0.28) 9px
  );
  animation: rain-fall 0.5s linear infinite;
  opacity: 0.6;
}
.stardew-weather-snow {
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
  background-image:
    radial-gradient(circle at 12% 18%, #fff 0 2px, transparent 2px),
    radial-gradient(circle at 38% 48%, #fff 0 3px, transparent 3px),
    radial-gradient(circle at 62% 12%, #fff 0 2px, transparent 2px),
    radial-gradient(circle at 78% 55%, #fff 0 2px, transparent 2px),
    radial-gradient(circle at 88% 30%, #fff 0 3px, transparent 3px);
  background-size: 140px 140px;
  animation: snow-drift 9s linear infinite;
  opacity: 0.75;
}
.stardew-weather-fog {
  position: absolute;
  inset: -8%;
  z-index: 8;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 28% 72%, rgba(255, 255, 255, 0.35) 0 30%, transparent 55%),
    radial-gradient(ellipse at 72% 62%, rgba(240, 245, 255, 0.28) 0 26%, transparent 52%);
  animation: fog-drift 14s ease-in-out infinite;
}
.stardew-weather-thunder {
  position: absolute;
  inset: 0;
  z-index: 9;
  pointer-events: none;
  background: rgba(255, 255, 240, 0.16);
  animation: thunder-flash 3.4s steps(1, end) infinite;
}

@keyframes stardew-cloud {
  0% { transform: translateX(0); }
  100% { transform: translateX(135vw); }
}
@keyframes rain-fall {
  from { background-position: 0 0; }
  to { background-position: 14px 32px; }
}
@keyframes snow-drift {
  from { background-position: 0 0, 20px 10px, 40px 0, 10px 30px, 50px 15px; }
  to { background-position: 24px 140px, 48px 150px, 68px 140px, 34px 170px, 78px 155px; }
}
@keyframes fog-drift {
  0%, 100% { transform: translate(-2%, 0); opacity: 0.65; }
  50% { transform: translate(2%, 1%); opacity: 0.85; }
}
@keyframes thunder-flash {
  0%, 9%, 14%, 100% { opacity: 0; }
  10% { opacity: 1; }
  12% { opacity: 0.3; }
  42% { opacity: 0; }
  43% { opacity: 0.5; }
  45% { opacity: 0; }
}

/* ===== PDF 装饰层：不替换 bg-sky，只叠加 ===== */
.stardew-side-tree {
  position: absolute;
  bottom: 0;
  width: min(28vw, 360px);
  height: auto;
  max-height: 70vh;
  object-fit: contain;
  object-position: bottom;
  image-rendering: pixelated;
  pointer-events: none;
  z-index: 5;
  opacity: 0.92;
  filter: drop-shadow(0 4px 0 rgba(0,0,0,0.12));
}
.stardew-side-tree--left {
  left: -2%;
  object-position: left bottom;
}
.stardew-side-tree--right {
  right: -2%;
  object-position: right bottom;
}
.is-night .stardew-side-tree {
  filter: brightness(0.55) saturate(0.7) drop-shadow(0 4px 0 rgba(0,0,0,0.2));
}
.time-dusk .stardew-side-tree {
  filter: brightness(0.85) sepia(0.25) drop-shadow(0 4px 0 rgba(0,0,0,0.15));
}

.stardew-fence {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 4%;
  height: 56px;
  z-index: 6;
  pointer-events: none;
  line-height: 0;
  filter: drop-shadow(0 3px 0 rgba(0,0,0,0.12));
}
.stardew-fence svg {
  width: 100%;
  height: 100%;
  display: block;
}
.season-winter .stardew-fence svg g {
  fill: #eef2f6;
  stroke: #b0bec5;
}
.season-autumn .stardew-fence svg g {
  fill: #f0e0c0;
  stroke: #c4a574;
}

.stardew-ground-decor {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 5%;
  height: 48px;
  z-index: 7;
  pointer-events: none;
}
.ground-flora {
  position: absolute;
  bottom: 8px;
  width: 14px;
  height: 18px;
  image-rendering: pixelated;
}
.season-spring .ground-flora {
  background:
    radial-gradient(circle at 50% 28%, #ffb7c5 0 3px, transparent 3px),
    radial-gradient(circle at 28% 48%, #fff 0 2px, transparent 2px),
    radial-gradient(circle at 72% 48%, #fff 0 2px, transparent 2px),
    linear-gradient(180deg, transparent 42%, #3d8b37 42% 100%);
}
.season-summer .ground-flora {
  background:
    radial-gradient(circle at 50% 30%, #ffeb3b 0 3px, transparent 3px),
    radial-gradient(circle at 50% 52%, #ff5722 0 2px, transparent 2px),
    linear-gradient(180deg, transparent 45%, #2e7d32 45% 100%);
}
.season-autumn .ground-flora {
  background:
    radial-gradient(ellipse at 50% 60%, #e67e22 0 5px, transparent 5px),
    linear-gradient(180deg, transparent 55%, #8d6e63 55% 100%);
  width: 16px;
  height: 12px;
}
.season-autumn .ground-flora:nth-child(3n) {
  background: radial-gradient(circle at 50% 50%, #d35400 0 4px, #f39c12 4px 6px, transparent 6px);
  width: 18px;
  height: 14px;
}
.season-winter .ground-flora {
  background: radial-gradient(ellipse at 50% 80%, #f5f7fa 0 8px, transparent 8px);
  width: 20px;
  height: 10px;
  opacity: 0.95;
}

.ground-prop {
  position: absolute;
  bottom: 14px;
  width: 28px;
  height: 28px;
  image-rendering: pixelated;
  object-fit: contain;
  filter: drop-shadow(0 2px 0 rgba(0,0,0,0.15));
}
.ground-prop--scarecrow { left: 12%; width: 32px; height: 32px; }
.ground-prop--birdhouse { left: 28%; }
.ground-prop--flower { right: 30%; }
.ground-prop--house { right: 12%; width: 30px; height: 30px; }
.season-winter .ground-prop { filter: brightness(0.9) drop-shadow(0 2px 0 rgba(0,0,0,0.1)); }
.season-autumn .ground-prop--flower { display: none; }

</style>
