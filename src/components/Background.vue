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

/** Time-of-day color wash over the pixel sky art (PDF day/dusk/night) */
const timeTint = computed(() => {
  if (timeOfDay.value === 'dawn')
    return 'linear-gradient(180deg, rgba(255,180,120,0.08) 0%, rgba(255,220,160,0.05) 40%, transparent 70%)'
  if (timeOfDay.value === 'dusk')
    return 'linear-gradient(180deg, rgba(255,100,40,0.12) 0%, rgba(230,80,60,0.08) 35%, rgba(40,20,60,0.12) 100%)'
  if (timeOfDay.value === 'night')
    return 'linear-gradient(180deg, rgba(10,20,50,0.35) 0%, rgba(15,30,60,0.25) 50%, rgba(10,25,40,0.25) 100%)'
  // day — slight warm lift matching PDF spring/summer brightness
  if (season.value === 'autumn')
    return 'linear-gradient(180deg, rgba(255,180,60,0.08) 0%, rgba(200,120,40,0.05) 50%, transparent 100%)'
  if (season.value === 'winter')
    return 'linear-gradient(180deg, rgba(200,220,240,0.1) 0%, rgba(180,200,220,0.06) 50%, transparent 100%)'
  return 'linear-gradient(180deg, rgba(135,206,250,0.04) 0%, transparent 50%)'
})

const sunStyle = computed(() => ({
  left: `${sunX.value}%`,
  top: `${Math.min(sunY.value, 38)}%`,
  opacity: isNight.value ? 0 : (timeOfDay.value === 'dusk' ? 0.9 : 1),
}))

const moonStyle = computed(() => ({
  left: `${moonX.value}%`,
  top: `${moonY.value}%`,
  opacity: isNight.value ? 0.95 : 0,
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
      <!-- Full pixel pastoral scene (matches PDF / preview.webp) -->
      <img
        class="stardew-bg-art"
        src="/images/background/bg-sky.png"
        alt=""
        draggable="false"
      >

      <!-- Time / season color wash -->
      <div class="stardew-time-tint" :style="{ background: timeTint }" />

      <!-- Sun along real-time arc -->
      <div v-show="showSun" class="stardew-sun" :style="sunStyle" />

      <!-- Moon + stars at night -->
      <div v-show="showMoon" class="stardew-moon" :style="moonStyle" />
      <div v-if="showStars" class="stardew-stars" aria-hidden="true">
        <span
          v-for="n in 28"
          :key="n"
          class="star"
          :style="{
            left: ((n * 37) % 100) + '%',
            top: ((n * 23) % 42) + '%',
            animationDelay: (n * 0.15) + 's',
            width: (2 + (n % 3)) + 'px',
            height: (2 + (n % 3)) + 'px',
          }"
        />
      </div>

      <!-- Extra drifting clouds for life -->
      <div class="stardew-clouds" :class="{ dense: isRain || isThunder || isFog }">
        <img class="cloud-img c1" src="/images/background/cloud-1-transparent.png" alt="">
        <img class="cloud-img c2" src="/images/background/cloud-2-transparent.png" alt="">
        <img class="cloud-img c3" src="/images/background/cloud-1-transparent.png" alt="">
      </div>

      <!-- Bottom decorations -->
      <img class="stardew-decor stardew-decor--cherry-l" src="/images/bg/cherry-left.png" alt="" draggable="false">
      <img class="stardew-decor stardew-decor--cherry-r" src="/images/bg/cherry-right.png" alt="" draggable="false">
      <img class="stardew-decor stardew-decor--house" src="/images/bg/pixel-house-bottom.png" alt="" draggable="false">
      <img class="stardew-decor stardew-decor--grass" src="/images/bg/grass-flowers.png" alt="" draggable="false">

      <!-- Weather overlays -->
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
  z-index: -1;
  overflow: hidden;
  background: #4db8f5;
}

.background-loading {
  position: absolute;
  inset: 0;
  background-color: #87CEEB;
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

/* ===== Full pastoral pixel scene ===== */
.stardew-scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  image-rendering: pixelated;
}

.stardew-bg-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center bottom;
  image-rendering: pixelated;
  pointer-events: none;
  z-index: 0;
  /* keep crisp pixels when scaled */
  -ms-interpolation-mode: nearest-neighbor;
}

.stardew-time-tint {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  transition: background 2.5s ease, opacity 2s ease;
}

.stardew-sun {
  position: absolute;
  width: 64px;
  height: 64px;
  margin-left: -32px;
  margin-top: -32px;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 50%, #fff8d0 0%, #ffe27a 40%, rgba(255, 200, 80, 0.35) 65%, transparent 100%);
  box-shadow:
    0 0 28px 10px rgba(255, 226, 122, 0.55),
    0 0 60px 20px rgba(255, 200, 80, 0.22) !important;
  transition: left 2s ease, top 2s ease, opacity 1.5s ease;
  z-index: 3;
  pointer-events: none;
  image-rendering: auto;
}

.time-dusk .stardew-sun {
  background: radial-gradient(circle at 50% 50%, #ffd59a 0%, #ff8c42 45%, rgba(255, 100, 40, 0.3) 70%, transparent 100%);
  box-shadow:
    0 0 28px 10px rgba(255, 140, 66, 0.5),
    0 0 55px 18px rgba(230, 80, 40, 0.22) !important;
}

.stardew-moon {
  position: absolute;
  width: 48px;
  height: 48px;
  margin-left: -24px;
  margin-top: -24px;
  border-radius: 50%;
  background: radial-gradient(circle at 38% 38%, #fdfbf0 0%, #e7dcc2 55%, transparent 100%);
  box-shadow: 0 0 24px 8px rgba(200, 210, 255, 0.4) !important;
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
  box-shadow: 0 0 3px 1px rgba(255, 255, 220, 0.85) !important;
  animation: star-twinkle 2.6s ease-in-out infinite;
}

@keyframes star-twinkle {
  0%, 100% { opacity: 0.3; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.2); }
}

.stardew-clouds {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
}
.stardew-clouds .cloud-img {
  position: absolute;
  opacity: 0.75;
  animation: stardew-cloud 80s linear infinite;
  image-rendering: pixelated;
  filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.06));
}
.stardew-clouds.dense .cloud-img {
  opacity: 0.9;
  filter: brightness(0.82) saturate(0.65);
}
.stardew-clouds .c1 { top: 8%; left: -15%; width: 220px; animation-duration: 85s; }
.stardew-clouds .c2 { top: 18%; left: -30%; width: 170px; animation-duration: 100s; animation-delay: -30s; }
.stardew-clouds .c3 { top: 5%; left: -50%; width: 240px; animation-duration: 120s; animation-delay: -50s; }
.is-night .stardew-clouds { opacity: 0.18; }

/* Weather */
.stardew-weather-rain {
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
  background: repeating-linear-gradient(
    -14deg,
    transparent 0,
    transparent 7px,
    rgba(180, 210, 255, 0.38) 7px,
    rgba(180, 210, 255, 0.38) 9px
  );
  animation: rain-fall 0.5s linear infinite;
  opacity: 0.75;
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
    radial-gradient(circle at 88% 30%, #fff 0 3px, transparent 3px),
    radial-gradient(circle at 48% 78%, #fff 0 2px, transparent 2px);
  background-size: 140px 140px;
  animation: snow-drift 9s linear infinite;
  opacity: 0.88;
}
.stardew-weather-fog {
  position: absolute;
  inset: -8%;
  z-index: 8;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 28% 72%, rgba(255, 255, 255, 0.5) 0 32%, transparent 58%),
    radial-gradient(ellipse at 72% 62%, rgba(240, 245, 255, 0.42) 0 28%, transparent 55%),
    linear-gradient(180deg, transparent 45%, rgba(220, 230, 240, 0.35) 100%);
  animation: fog-drift 14s ease-in-out infinite;
}
.stardew-weather-thunder {
  position: absolute;
  inset: 0;
  z-index: 9;
  pointer-events: none;
  background: rgba(255, 255, 240, 0.22);
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
  from { background-position: 0 0, 20px 10px, 40px 0, 10px 30px, 50px 15px, 30px 40px; }
  to { background-position: 24px 140px, 48px 150px, 68px 140px, 34px 170px, 78px 155px, 54px 180px; }
}
@keyframes fog-drift {
  0%, 100% { transform: translate(-2%, 0); opacity: 0.75; }
  50% { transform: translate(2%, 1%); opacity: 0.95; }
}
@keyframes thunder-flash {
  0%, 9%, 14%, 100% { opacity: 0; }
  10% { opacity: 1; }
  12% { opacity: 0.35; }
  42% { opacity: 0; }
  43% { opacity: 0.65; }
  45% { opacity: 0; }
}

/* ===== Bottom scene decorations ===== */
.stardew-decor {
  position: absolute;
  pointer-events: none;
  z-index: 5;
  image-rendering: pixelated;
}
.stardew-decor--cherry-l {
  left: -40px;
  bottom: -20px;
  width: 260px;
  height: auto;
}
.stardew-decor--cherry-r {
  right: -40px;
  bottom: -20px;
  width: 260px;
  height: auto;
}
.stardew-decor--house {
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 420px;
  height: auto;
}
.stardew-decor--grass {
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: auto;
  z-index: 6;
}
</style>
