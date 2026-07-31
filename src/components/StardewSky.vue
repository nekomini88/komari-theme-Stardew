<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useVisualStyle } from '@/composables/useVisualStyle'

const { current } = useVisualStyle()

const now = ref(new Date())
const season = computed(() => {
  const m = now.value.getMonth() + 1
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'autumn'
  return 'winter'
})
type Weather = 'clear' | 'rain' | 'fog' | 'snow' | 'thunder'
const weather = ref<Weather>('clear')

onMounted(() => {
  const tick = () => { now.value = new Date() }
  const t = setInterval(tick, 60_000)
  tick()
  setWeather()
  const w = setInterval(setWeather, 5 * 60_000)
  onUnmounted(() => { clearInterval(t); clearInterval(w) })
})

function setWeather() {
  const s = season.value
  const r = Math.random()
  const pool: Weather[] = s === 'winter'
    ? r < 0.45 ? ['clear'] : r < 0.7 ? ['snow'] : r < 0.85 ? ['thunder'] : ['fog']
    : s === 'summer'
    ? r < 0.55 ? ['clear'] : r < 0.8 ? ['rain'] : r < 0.9 ? ['thunder'] : ['fog']
    : s === 'autumn'
    ? r < 0.5 ? ['clear'] : r < 0.75 ? ['rain'] : r < 0.85 ? ['fog'] : ['thunder']
    : r < 0.45 ? ['clear'] : r < 0.7 ? ['rain'] : r < 0.85 ? ['fog'] : ['snow']
  weather.value = pool[Math.floor(Math.random() * pool.length)] as Weather
}

function sunX() {
  const d = now.value
  const mins = d.getHours() * 60 + d.getMinutes()
  const dayStart = 5 * 60
  const dayEnd = 19 * 60
  if (mins <= dayStart) return '0%'
  if (mins >= dayEnd) return '100%'
  return ((mins - dayStart) / (dayEnd - dayStart)) * 100 + '%'
}

function skyBase(): string {
  const h = now.value.getHours()
  const w = weather.value
  if (w === 'thunder') return 'oklch(0.55 0.04 260)'
  if (w === 'rain' || w === 'fog' || w === 'snow') {
    if (h >= 5 && h < 8) return 'oklch(0.82 0.04 70)'
    if (h >= 8 && h < 17) return 'oklch(0.88 0.03 180)'
    if (h >= 17 && h < 20) return 'oklch(0.72 0.05 40)'
    return 'oklch(0.2 0.01 260)'
  }
  if (h >= 5 && h < 8) return 'oklch(0.88 0.07 85)'
  if (h >= 8 && h < 17) return 'oklch(0.94 0.04 95)'
  if (h >= 17 && h < 20) return 'oklch(0.82 0.08 55)'
  return 'oklch(0.24 0.02 260)'
}
</script>

<template>
  <div v-if="current === 'stardew'" class="stardew-sky" :data-season="season" :data-weather="weather">
    <div class="sky-gradient" :style="{ background: skyBase() }"></div>

    <!-- celestial -->
    <div class="sky-sun" :style="{ left: sunX() }" aria-hidden="true"></div>
    <div class="sky-moon" aria-hidden="true"></div>

    <!-- clouds -->
    <div class="sky-clouds" aria-hidden="true">
      <span class="cloud c1"></span>
      <span class="cloud c2"></span>
      <span class="cloud c3"></span>
    </div>

    <!-- weather overlays -->
    <div class="sky-overlay" :data-weather="weather" aria-hidden="true"></div>

    <!-- ground layers -->
    <img
      class="sky-layer tree"
      src="/private-assets/stardew/tree.png"
      alt=""
      aria-hidden="true"
      @error="($event.target as HTMLImageElement).style.display='none'"
    />
    <img
      class="sky-layer grass"
      src="/private-assets/stardew/grass.png"
      alt=""
      aria-hidden="true"
      @error="($event.target as HTMLImageElement).style.display='none'"
    />
    <img
      class="sky-layer grass"
      src="/private-assets/stardew/grass-strip.png"
      alt=""
      aria-hidden="true"
      @error="($event.target as HTMLImageElement).style.display='none'"
    />

    <!-- legacy lighting hook for any third-party visibility -->
    <div class="sky-light" :data-weather="weather"></div>
  </div>
</template>

<style scoped>
.stardew-sky {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}
.sky-gradient {
  position: absolute;
  inset: 0;
  transition: background 1.2s ease;
}
.sky-sun {
  position: absolute;
  top: 18%;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: oklch(0.96 0.18 85);
  box-shadow:
    0 0 0 6px oklch(0.94 0.15 80 / 0.35),
    0 0 30px oklch(0.93 0.18 75 / 0.45);
  transform: translate(-50%, -50%);
  transition: left 1.2s ease;
}
.sky-moon {
  position: absolute;
  top: 14%;
  right: 14%;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: oklch(0.97 0.02 260);
  box-shadow: 0 0 12px oklch(0.9 0.03 260 / 0.55);
}
.cloud {
  position: absolute;
  background: oklch(0.99 0.01 80 / 0.85);
  border-radius: 12px;
  box-shadow: inset 0 0 0 2px oklch(0.82 0.02 85 / 0.45);
  opacity: 0.85;
}
.c1 {
  width: 140px; height: 42px; top: 12%; left: 10%;
  animation: drift 42s linear infinite;
}
.c2 {
  width: 100px; height: 34px; top: 8%; left: 55%;
  animation: drift 58s linear infinite;
}
.c3 {
  width: 120px; height: 38px; top: 18%; left: 30%;
  animation: drift 64s linear infinite reverse;
}
@keyframes drift {
  from { transform: translateX(0); }
  to   { transform: translateX(110vw); }
}
.sky-layer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 26%;
  background-size: cover;
  background-position: bottom;
  background-repeat: repeat-x;
  pointer-events: none;
}
.sky-layer.tree { z-index: 2; height: 34%; }
.sky-layer.grass { z-index: 3; height: 22%; }

/* ------------------------------------------------------------------ */
/* weather overlays (CSS-only, no extra assets)                        */
/* ------------------------------------------------------------------ */
.sky-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 1.2s ease;
}
.sky-overlay[data-weather='rain'] {
  opacity: 1;
  background-image:
    repeating-linear-gradient(120deg, oklch(0.78 0.04 220 / 0.18) 0px, transparent 3px 12px);
  animation: rainlines 0.9s linear infinite;
}
.sky-overlay[data-weather='fog'] {
  opacity: 1;
  background: linear-gradient(180deg, transparent 0%, oklch(0.86 0.02 95 / 0.55) 100%);
}
.sky-overlay[data-weather='snow'] {
  opacity: 1;
  background-image:
    radial-gradient(oklch(0.98 0 0 / 0.85) 1px, transparent 1.5px);
  background-size: 12px 12px;
  animation: snowfall 1.4s linear infinite;
}
.sky-overlay[data-weather='thunder'] {
  opacity: 1;
  background: transparent;
  animation: lightning 3.5s ease-in-out infinite;
}
.sky-overlay[data-weather='clear'] {
  opacity: 0;
  background: transparent;
}

@keyframes rainlines {
  from { background-position: 0 0; }
  to   { background-position: 60px 60px; }
}
@keyframes snowfall {
  from { background-position: 0 0; }
  to   { background-position: 12px 28px; }
}
@keyframes lightning {
  0%, 88%, 92%, 96%, 100% { opacity: 0; }
  89%, 91%, 95% { opacity: 1; background: oklch(0.98 0.02 90 / 0.25); }
}

/* legacy hook kept for any third-party themes */
.sky-light[data-weather='clear'] { background: transparent; }
.sky-light[data-weather='rain'] {
  background-image:
    repeating-linear-gradient(120deg, oklch(0.78 0.04 220 / 0.28) 0px, transparent 3px 12px);
  animation: rainlines 0.9s linear infinite;
}
.sky-light[data-weather='fog'] {
  background: linear-gradient(180deg, transparent 0%, oklch(0.86 0.02 95 / 0.55) 100%);
}
</style>
