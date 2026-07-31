<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { season as seasonRef, setWeather, isNight, isThunder, isRain, isSnow, isFog } from '@/composables/useStardewAtmosphere'

const season = seasonRef
const weather = ref<'clear' | 'rain' | 'snow' | 'thunder' | 'fog'>('clear')
const thumb = ref(0)
let timer: number | null = null

const sunY = computed(() => {
  const day = isNight.value ? 1 : Math.sin((thumb.value / 100) * Math.PI)
  return Math.round(day * 40)
})
const moonY = computed(() => {
  const night = isNight.value ? Math.sin((thumb.value / 100) * Math.PI) : 0
  return Math.round(night * 32)
})
const tint = computed(() => {
  const s = season.value
  const l = isNight.value ? 0.78 : 0.92
  if (s === 'spring') return `oklch(0.72 0.06 138 / 0.28)`
  if (s === 'summer') return `oklch(0.8 0.08 92 / 0.24)`
  if (s === 'autumn') return `oklch(0.78 0.08 72 / 0.24)`
  return `oklch(0.88 0.04 235 / 0.18)`
})

function tick() {
  thumb.value = (thumb.value + 1) % 100
}
function mount() { timer = window.setInterval(tick, 1200) }
function unmount() { if (timer !== null) { clearInterval(timer); timer = null } }

onMounted(mount)
onUnmounted(unmount)

defineExpose({ setWeather, season, tint, sunY, moonY })
</script>

<template>
  <div class="stardew-sky" :style="{ background: `linear-gradient(180deg, #cfe8ff 0%, #ffe8a8 70%, #8cbfd8 100%)` }">
    <div class="stardew-sky-season" :style="{ background: tint }" />
    <div
      class="stardew-sun"
      :style="{
        top: sunY + '%',
        background: isNight ? 'rgba(255,240,220,0.7)' : 'radial-gradient(circle, #fff4c2 0%, rgba(255,238,110,0.9) 60%, transparent 100%)',
      }"
    />
    <div
      class="stardew-moon"
      :style="{
        top: moonY + '%',
        opacity: isNight ? 0.85 : 0,
        background: 'radial-gradient(circle at 35% 35%, #fdfbf0 0%, #eae0c8 55%, transparent 100%)'
      }"
    />
    <div v-if="isRain" class="stardew-rain" />
    <div v-if="isSnow" class="stardew-snow" />
    <div v-if="isThunder" class="stardew-thunder" />
    <div v-if="isFog" class="stardew-fog" />
  </div>
</template>

<style>
.stardew-sky { position: fixed; inset: 0; pointer-events: none; z-index: 10; }
.stardew-sky-season { position: absolute; inset: 0; mix-blend-mode: overlay; }
.stardew-sun,
.stardew-moon {
  position: absolute; left: 68%; width: 110px; height: 110px; border-radius: 50%; transform: translateX(-50%); animation: stardew-sky-arc 32s linear infinite;
}
.stardew-sun { animation: stardew-sun-rise 28s ease-in-out infinite alternate; }
.stardew-moon { animation: stardew-moon-rise 28s ease-in-out infinite alternate; }

.stardew-rain {
  position: absolute; inset: 0;
  background: repeating-linear-gradient(180deg, rgba(180,210,255,0.45) 0px, rgba(180,210,255,0.45) 2px, transparent 2px, transparent 9px);
  animation: stardew-rain-move 0.7s linear infinite;
}
.stardew-snow {
  position: absolute; inset: 0;
  background:
    radial-gradient(circle at 20% 30%, rgba(255,255,255,0.9) 0 3px, transparent 3px),
    radial-gradient(circle at 70% 60%, rgba(255,255,255,0.85) 0 3px, transparent 3px),
    radial-gradient(circle at 40% 80%, rgba(255,255,255,0.75) 0 2px, transparent 2px);
  animation: stardew-snowdrift 9s linear infinite;
}
.stardew-thunder {
  position: fixed; inset: 0; pointer-events: none; background: rgba(255,255,240,0.22); animation: stardew-flash-thunder 1s steps(2, end) infinite;
}
.stardew-fog {
  position: absolute; inset: -20%;
  background: radial-gradient(circle at 30% 50%, rgba(255,255,255,0.35) 0 30%, transparent 60%),
              radial-gradient(circle at 75% 55%, rgba(255,255,255,0.28) 0 28%, transparent 60%);
  animation: stardew-fogdrift 10s ease-in-out infinite;
}

@keyframes stardew-sun-rise { 0% { top: 110%; } 100% { top: 30%; } }
@keyframes stardew-moon-rise { 0% { top: 90%; opacity: 0.1; } 100% { top: 26%; opacity: 0.85; } }
@keyframes stardew-sky-arc { 0% { transform: translateX(-50%) translateX(-10vw); } 50% { transform: translateX(-50%) translateX(10vw); } 100% { transform: translateX(-50%) translateX(-10vw); } }
@keyframes stardew-rain-move { from { transform: translateY(-10px); } to { transform: translateY(20px); } }
@keyframes stardew-snowdrift { 0% { transform: translate(0,0); opacity: 0.8; } 100% { transform: translate(12px, 12vh); opacity: 0.2; } }
@keyframes stardew-flash-thunder { 0% { opacity: 0; } 10% { opacity: 1; } 25% { opacity: 0; } 40% { opacity: 0.6; } 55% { opacity: 0; } 100% { opacity: 0; } }
@keyframes stardew-fogdrift { 0% { transform: translate(-3%,-1%); } 50% { transform: translate(3%,1%); } 100% { transform: translate(-3%,-1%); } }
</style>
