<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import {
  grassGradients,
  isFog,
  isNight,
  isRain,
  isSnow,
  isThunder,
  moonX,
  moonY,
  season,
  skyGradients,
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

// Stardew living world — always on for this theme package
const showDefaultBackground = computed(() => false)
const showStardewBackground = computed(() => true)

const skyStyle = computed(() => {
  const s = season.value
  const t = timeOfDay.value
  return { background: skyGradients[s][t] }
})

const grassStyle = computed(() => grassGradients[season.value].back)
const grassFrontStyle = computed(() => grassGradients[season.value].front)

const sunStyle = computed(() => ({
  left: `${sunX.value}%`,
  top: `${sunY.value}%`,
  opacity: isNight.value ? 0 : (timeOfDay.value === 'dusk' ? 0.85 : 1),
}))

const moonStyle = computed(() => ({
  left: `${moonX.value}%`,
  top: `${moonY.value}%`,
  opacity: isNight.value ? 0.92 : 0,
}))

const showSun = computed(() => !isNight.value && weather.value !== 'thunder')
const showMoon = computed(() => isNight.value)
const showStars = computed(() => isNight.value)

// Season accent decorations (CSS-drawn to avoid extra assets)
const seasonAccentClass = computed(() => `season-${season.value}`)

const fenceSvg = `<svg viewBox="0 0 1200 80" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <g fill="#8b5a2b" stroke="#5c3a1e" stroke-width="2">
    <rect x="40" y="20" width="14" height="60" rx="2"/>
    <rect x="160" y="20" width="14" height="60" rx="2"/>
    <rect x="280" y="20" width="14" height="60" rx="2"/>
    <rect x="400" y="20" width="14" height="60" rx="2"/>
    <rect x="520" y="20" width="14" height="60" rx="2"/>
    <rect x="640" y="20" width="14" height="60" rx="2"/>
    <rect x="760" y="20" width="14" height="60" rx="2"/>
    <rect x="880" y="20" width="14" height="60" rx="2"/>
    <rect x="1000" y="20" width="14" height="60" rx="2"/>
    <rect x="1120" y="20" width="14" height="60" rx="2"/>
    <rect x="20" y="34" width="1160" height="12" rx="3"/>
    <rect x="20" y="56" width="1160" height="12" rx="3"/>
  </g>
</svg>`

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
  imageLoader.onload = () => {
    isLoaded.value = true
    hasError.value = false
  }
  imageLoader.onerror = () => {
    isLoaded.value = false
    hasError.value = true
  }
  imageLoader.src = url
}

const videoRef = ref<HTMLVideoElement | null>(null)

function handleVideoLoaded() {
  isLoaded.value = true
  hasError.value = false
}
function handleVideoError() {
  isLoaded.value = false
  hasError.value = true
}

watch([currentUrl, backgroundType], ([url, type]) => {
  if (url && type === 'image') {
    loadImage(url)
  }
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

onUnmounted(() => {
  clearImageLoader()
})
</script>

<template>
    <div class="background-container" :style="backgroundContainerStyle">
    <!-- Living Stardew world: time / season / weather -->
    <Transition name="fade">
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
        <!-- Dynamic sky gradient (PDF day/dusk/night) -->
        <div class="stardew-sky-grad" :style="skyStyle" />

        <!-- Sun follows real time arc -->
        <div v-show="showSun" class="stardew-sun" :style="sunStyle" />

        <!-- Moon at night -->
        <div v-show="showMoon" class="stardew-moon" :style="moonStyle" />

        <!-- Stars -->
        <div v-if="showStars" class="stardew-stars" aria-hidden="true">
          <span v-for="n in 24" :key="n" class="star" :style="{
            left: ((n * 37) % 100) + '%',
            top: ((n * 23) % 45) + '%',
            animationDelay: (n * 0.17) + 's',
            width: (2 + (n % 3)) + 'px',
            height: (2 + (n % 3)) + 'px',
          }" />
        </div>

        <!-- Clouds -->
        <div class="stardew-clouds" :class="{ dense: isRain || isThunder || isFog }">
          <img class="cloud-img c1" src="/images/background/cloud-1-transparent.png" alt="">
          <img class="cloud-img c2" src="/images/background/cloud-2-transparent.png" alt="">
          <img class="cloud-img c3" src="/images/background/cloud-1-transparent.png" alt="">
        </div>

        <!-- Seasonal ground -->
        <div class="stardew-grass" :style="grassStyle" />
        <div class="stardew-grass-front" :style="grassFrontStyle" />

        <!-- Fence -->
        <div class="stardew-fence" v-html="fenceSvg" />

        <!-- Season flora strip (CSS flowers / leaves / snow / pumpkins) -->
        <div class="stardew-flora-strip" aria-hidden="true">
          <span v-for="i in 14" :key="i" class="flora-item" :style="{ left: (i * 7.1 - 2) + '%' }" />
        </div>

        <!-- Weather layers -->
        <div v-if="isRain" class="stardew-weather-rain" />
        <div v-if="isSnow" class="stardew-weather-snow" />
        <div v-if="isThunder" class="stardew-weather-thunder" />
      </div>
    </Transition>

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
  z-index: -1;
  overflow: hidden;
}

.background-loading {
  position: absolute;
  inset: 0;
  background-color: var(--background);
}

.background-media {
  position: absolute;
  inset: 0;
  transform: scale(1.1);
  transition: opacity 0.8s ease;
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
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.8s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ===== Stardew living scene ===== */
.stardew-scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  image-rendering: pixelated;
}

.stardew-sky-grad {
  position: absolute;
  inset: 0;
  transition: background 2.5s ease;
  z-index: 0;
}

.stardew-bg-sky {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  pointer-events: none;
  z-index: 1;
  transition: opacity 2s ease;
}

.stardew-sun {
  position: absolute;
  width: 72px;
  height: 72px;
  margin-left: -36px;
  margin-top: -36px;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 50%, #fff6c4 0%, #ffe27a 45%, rgba(255, 180, 60, 0.35) 70%, transparent 100%);
  box-shadow:
    0 0 40px 14px rgba(255, 226, 122, 0.55),
    0 0 80px 28px rgba(255, 200, 80, 0.25);
  transition: left 2s ease, top 2s ease, opacity 1.5s ease;
  z-index: 2;
  pointer-events: none;
}

.time-dusk .stardew-sun {
  background: radial-gradient(circle at 50% 50%, #ffd59a 0%, #ff8c42 50%, rgba(255, 100, 40, 0.3) 75%, transparent 100%);
  box-shadow:
    0 0 36px 12px rgba(255, 140, 66, 0.5),
    0 0 70px 24px rgba(230, 80, 40, 0.2);
}

.stardew-moon {
  position: absolute;
  width: 56px;
  height: 56px;
  margin-left: -28px;
  margin-top: -28px;
  border-radius: 50%;
  background: radial-gradient(circle at 38% 38%, #fdfbf0 0%, #e7dcc2 55%, rgba(231, 220, 194, 0) 100%);
  box-shadow: 0 0 30px 10px rgba(200, 210, 255, 0.35);
  transition: left 2s ease, top 2s ease, opacity 1.5s ease;
  z-index: 2;
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
  box-shadow: 0 0 4px 1px rgba(255, 255, 220, 0.8);
  animation: star-twinkle 2.8s ease-in-out infinite;
}

@keyframes star-twinkle {
  0%, 100% { opacity: 0.35; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.15); }
}

.stardew-clouds {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  transition: opacity 1.5s ease;
}

.stardew-clouds .cloud-img {
  position: absolute;
  opacity: 0.88;
  animation: stardew-cloud 70s linear infinite;
  filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.08));
}

.stardew-clouds.dense .cloud-img {
  opacity: 0.95;
  filter: brightness(0.85) saturate(0.7);
}

.stardew-clouds .c1 { top: 10%; left: -12%; width: 200px; animation-duration: 150s; }
.stardew-clouds .c2 { top: 20%; left: -28%; width: 160px; transform: scale(0.75); animation-duration: 180s; animation-delay: -25s; }
.stardew-clouds .c3 { top: 6%; left: -45%; width: 220px; transform: scale(1.05); animation-duration: 210s; animation-delay: -40s; }

.is-night .stardew-clouds { opacity: 0.2; }

.stardew-grass {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 18%;
  box-shadow: inset 0 8px 0 rgba(255, 255, 255, 0.1);
  transition: background 2s ease;
  z-index: 4;
}

.stardew-grass-front {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 9%;
  border-top: 3px solid rgba(0, 0, 0, 0.12);
  transition: background 2s ease;
  z-index: 6;
}

.stardew-fence {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 16%;
  height: 72px;
  line-height: 0;
  pointer-events: none;
  filter: drop-shadow(0 4px 0 rgba(0, 0, 0, 0.12));
  z-index: 5;
}

/* Seasonal flora along the fence line */
.stardew-flora-strip {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 17%;
  height: 28px;
  z-index: 5;
  pointer-events: none;
}

.flora-item {
  position: absolute;
  bottom: 0;
  width: 12px;
  height: 16px;
  image-rendering: pixelated;
}

/* Spring: pink/white flowers */
.season-spring .flora-item {
  background:
    radial-gradient(circle at 50% 30%, #ffb7c5 0 3px, transparent 3px),
    radial-gradient(circle at 30% 50%, #fff 0 2px, transparent 2px),
    radial-gradient(circle at 70% 50%, #fff 0 2px, transparent 2px),
    linear-gradient(180deg, transparent 40%, #3d8b37 40% 100%);
  border-radius: 50% 50% 40% 40%;
}

/* Summer: bright yellow/red blooms */
.season-summer .flora-item {
  background:
    radial-gradient(circle at 50% 35%, #ffeb3b 0 3px, transparent 3px),
    radial-gradient(circle at 50% 55%, #ff5722 0 2px, transparent 2px),
    linear-gradient(180deg, transparent 45%, #2e7d32 45% 100%);
}

/* Autumn: orange leaves / pumpkin dots */
.season-autumn .flora-item {
  background:
    radial-gradient(ellipse at 50% 60%, #e67e22 0 5px, transparent 5px),
    linear-gradient(180deg, transparent 55%, #8d6e63 55% 100%);
  width: 14px;
  height: 12px;
}

.season-autumn .flora-item:nth-child(3n) {
  background: radial-gradient(circle at 50% 50%, #d35400 0 4px, #f39c12 4px 6px, transparent 6px);
  width: 16px;
  height: 14px;
}

/* Winter: snow piles */
.season-winter .flora-item {
  background: radial-gradient(ellipse at 50% 80%, #f5f7fa 0 7px, transparent 7px);
  width: 18px;
  height: 10px;
  opacity: 0.95;
}

/* Weather overlays */
.stardew-weather-rain {
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
  background: repeating-linear-gradient(
    -12deg,
    transparent 0,
    transparent 6px,
    rgba(180, 210, 255, 0.35) 6px,
    rgba(180, 210, 255, 0.35) 8px
  );
  animation: rain-fall 0.55s linear infinite;
  opacity: 0.7;
}

.stardew-weather-snow {
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
  background-image:
    radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.95) 0 2px, transparent 2px),
    radial-gradient(circle at 30% 50%, rgba(255, 255, 255, 0.85) 0 3px, transparent 3px),
    radial-gradient(circle at 55% 15%, rgba(255, 255, 255, 0.9) 0 2px, transparent 2px),
    radial-gradient(circle at 70% 60%, rgba(255, 255, 255, 0.8) 0 2px, transparent 2px),
    radial-gradient(circle at 85% 35%, rgba(255, 255, 255, 0.9) 0 3px, transparent 3px),
    radial-gradient(circle at 45% 80%, rgba(255, 255, 255, 0.75) 0 2px, transparent 2px);
  background-size: 120px 120px;
  animation: snow-drift 8s linear infinite;
  opacity: 0.85;
}

.stardew-weather-fog {
  position: absolute;
  inset: -10%;
  z-index: 8;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 30% 70%, rgba(255, 255, 255, 0.45) 0 35%, transparent 60%),
    radial-gradient(ellipse at 75% 60%, rgba(240, 245, 255, 0.4) 0 30%, transparent 55%),
    linear-gradient(180deg, transparent 40%, rgba(220, 230, 240, 0.35) 100%);
  animation: fog-drift 14s ease-in-out infinite;
}

.stardew-weather-thunder {
  position: absolute;
  inset: 0;
  z-index: 9;
  pointer-events: none;
  background: rgba(255, 255, 240, 0.2);
  animation: thunder-flash 3.2s steps(1, end) infinite;
}

@keyframes stardew-cloud {
  0% { transform: translateX(0); }
  100% { transform: translateX(130vw); }
}

@keyframes rain-fall {
  from { background-position: 0 0; }
  to { background-position: 12px 28px; }
}

@keyframes snow-drift {
  from { background-position: 0 0, 20px 10px, 40px 0, 10px 30px, 50px 15px, 30px 40px; }
  to { background-position: 20px 120px, 40px 130px, 60px 120px, 30px 150px, 70px 135px, 50px 160px; }
}

@keyframes fog-drift {
  0%, 100% { transform: translate(-2%, 0); opacity: 0.75; }
  50% { transform: translate(2%, 1%); opacity: 0.95; }
}

@keyframes thunder-flash {
  0%, 8%, 12%, 100% { opacity: 0; }
  9% { opacity: 1; }
  11% { opacity: 0.4; }
  40% { opacity: 0; }
  41% { opacity: 0.7; }
  43% { opacity: 0; }
}
</style>
