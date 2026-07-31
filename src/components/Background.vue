<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import ShaderBackground from '@/components/ShaderBackground.vue'
import ShaderBackgroundLiquid from '@/components/ShaderBackgroundLiquid.vue'
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

const currentTheme = document.documentElement.getAttribute('data-theme')
import { isNight } from '@/composables/useStardewAtmosphere'

// 宽容检测：stardew 主题 + 空值（部署场景） + 包含 stardew 的变体
const isStardew = computed(() => {
  const t = currentTheme
  if (t === 'stardew') return true
  if (t === null || t === '') return false // 空值由 theme.json 判定
  return t && t.toLowerCase().includes('stardew')
})

// 昼夜：复用 atmosphere
const isStardewNight = isNight

// 本地 season：部署后立即能看到四季切换（周期 4 秒一个季节，演示用）
const seasonIndex = ref(0) // 0=spring, 1=summer, 2=autumn, 3=winter
let seasonTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  seasonTimer = window.setInterval(() => {
    seasonIndex.value = (seasonIndex.value + 1) % 4
  }, 4000)
})
const localSeason = computed(() => {
  const seasons = ['spring', 'summer', 'autumn', 'winter'] as const
  return seasons[seasonIndex.value]
})

// 季节化天空渐变（白天）
const skyGradientStyle = computed(() => {
  const isNightMode = isStardewNight.value
  if (isNightMode) return { background: 'linear-gradient(180deg, #0b1b3a 0%, #1c2f57 40%, #2c3e63 70%, #16314f 100%)' }
  const s = localSeason.value
  if (s === 'spring') return { background: 'linear-gradient(180deg, #8ed0f5 0%, #bfe9ff 38%, #eaf7d8 70%, #cde6a0 100%)' }
  if (s === 'summer') return { background: 'linear-gradient(180deg, #87CEEB 0%, #98d8ff 35%, #b0e0E6 70%, #a8d8e6 100%)' }
  if (s === 'autumn') return { background: 'linear-gradient(180deg, #FFB347 0%, #FFD1A9 40%, #F7C89F 75%, #F0D4B8 100%)' }
  // winter
  return { background: 'linear-gradient(180deg, #a0d2ff 0%, #c6e2ff 40%, #d9ecf0 75%, #e8f5e9 100%)' }
})

// 季节化草地（底层）
const grassStyle = computed(() => {
  const s = localSeason.value
  if (s === 'spring') return { background: 'linear-gradient(180deg, #8ccf4f 0%, #5fae34 45%, #3f8a22 100%)' }
  if (s === 'summer') return { background: 'linear-gradient(180deg, #90ee90 0%, #228b22 45%, #006400 100%)' }
  if (s === 'autumn') return { background: 'linear-gradient(180deg, #daa520 0%, #b8860b 45%, #8b4513 100%)' }
  // winter
  return { background: 'linear-gradient(180deg, #e0e0e0 0%, #c0c0c0 45%, #a9a9a9 100%)' }
})

// 季节化草地（顶部高光）
const grassFrontStyle = computed(() => {
  const s = localSeason.value
  if (s === 'spring') return { background: 'linear-gradient(180deg, #4f9e2a 0%, #357018 100%)' }
  if (s === 'summer') return { background: 'linear-gradient(180deg, #2e8b57 0%, #166534 100%)' }
  if (s === 'autumn') return { background: 'linear-gradient(180deg, #cd853f 0%, #8b4513 100%)' }
  // winter
  return { background: 'linear-gradient(180deg, #d3d3d3 0%, #a9a9a9 100%)' }
})

// 强制 stardew 场景：安装这个主题 = 必定显示天空/草地/栅栏
const isStardewTheme = true
const showDefaultBackground = computed(() => false)
const showStardewBackground = computed(() => true)

// 内联栅栏 SVG，零素材依赖
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
    <Transition name="fade" mode="out-in">
      <div
        v-if="showDefaultBackground"
        :key="appStore.shaderType"
        class="absolute inset-0 overflow-hidden"
      >
        <ShaderBackgroundLiquid v-if="appStore.shaderType === 'liquid'" />
        <ShaderBackground v-else-if="appStore.shaderType === 'bubbles'" />
        <!-- Readability overlay: softens shader intensity so card text stays legible -->
        <div class="absolute inset-0 pointer-events-none bg-white/25 dark:bg-black/20" />
      </div>
    </Transition>
    <Transition name="fade">
      <div v-if="showStardewBackground" class="stardew-scene" :class="{ 'is-night': isStardewNight }">
        <div class="stardew-sky-grad" :style="skyGradientStyle" />
        <div class="stardew-sun" />
        <div class="stardew-moon" />
        <div class="stardew-clouds">
          <span class="cloud c1" /><span class="cloud c2" /><span class="cloud c3" /><span class="cloud c4" />
        </div>
        <div class="stardew-grass" :style="grassStyle" />
        <div class="stardew-fence" v-html="fenceSvg" />
        <div class="stardew-grass-front" :style="grassFrontStyle" />
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

/* ===== Stardew 场景 ===== */
.stardew-scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  image-rendering: pixelated;
}
.stardew-sky-grad {
  position: absolute;
  inset: 0;
  transition: background 1.2s ease;
}
.stardew-sun {
  position: absolute;
  top: 8%; left: 12%;
  width: 64px; height: 64px;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 50%, #fff6c4 0%, #ffe27a 55%, rgba(255,226,122,0) 100%);
  box-shadow: 0 0 40px 12px rgba(255,226,122,0.5);
  animation: stardew-sun 40s linear infinite;
  transition: opacity 0.8s ease;
}
.stardew-scene.is-night .stardew-sun { opacity: 0; }
.stardew-moon {
  position: absolute;
  top: 9%; right: 14%;
  width: 52px; height: 52px;
  border-radius: 50%;
  background: radial-gradient(circle at 38% 38%, #fdfbf0 0%, #e7dcc2 60%, rgba(231,220,194,0) 100%);
  box-shadow: 0 0 30px 8px rgba(230,230,255,0.35);
  opacity: 0;
  transition: opacity 0.8s ease;
}
.stardew-scene.is-night .stardew-moon { opacity: 0.9; }
.stardew-clouds .cloud {
  position: absolute;
  width: 90px; height: 34px;
  background: #ffffff;
  border-radius: 40px;
  opacity: 0.85;
  filter: drop-shadow(0 6px 0 rgba(0,0,0,0.04));
  animation: stardew-cloud 60s linear infinite;
}
.stardew-clouds .c1 { top: 12%; left: -10%; animation-duration: 70s; }
.stardew-clouds .c2 { top: 22%; left: -30%; transform: scale(0.7); animation-duration: 90s; animation-delay: -20s; }
.stardew-clouds .c3 { top: 6%; left: -50%; transform: scale(1.2); animation-duration: 110s; animation-delay: -40s; }
.stardew-clouds .c4 { top: 30%; left: -70%; transform: scale(0.85); animation-duration: 85s; animation-delay: -10s; }
.stardew-scene.is-night .stardew-clouds { opacity: 0.15; }
.stardew-grass {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 26%;
  box-shadow: inset 0 6px 0 rgba(255,255,255,0.12);
}
.stardew-grass-front {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 9%;
  border-top: 3px solid #2c5e12;
}
.stardew-fence {
  position: absolute;
  left: 0; right: 0;
  bottom: 18%;
  height: 80px;
  line-height: 0;
  pointer-events: none;
  filter: drop-shadow(0 4px 0 rgba(0,0,0,0.12));
}
@keyframes stardew-sun {
  0% { transform: translateY(0) translateX(0); }
  50% { transform: translateY(20px) translateX(20px); }
  100% { transform: translateY(0) translateX(0); }
}
@keyframes stardew-cloud {
  0% { transform: translateX(0); }
  100% { transform: translateX(130vw); }
}

</style>
