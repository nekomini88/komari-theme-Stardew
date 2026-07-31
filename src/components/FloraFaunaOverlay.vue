<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { season, isNight, isThunder, isRain, isSnow, isFog } from '@/composables/useStardewAtmosphere'

const items = ref<Array<{ id: number; x: number; y: number; type: string; life: number }>>([])
let nextId = 0
const MAX = 14
let raf: number | null = null
let last = 0
const SPAWN_INTERVAL = 900
const THUNDER_FLASH = 1400

function pickType() {
  const s = season.value
  if (isThunder.value) return 'lightning'
  if (s === 'winter') {
    if (isSnow.value) return Math.random() < 0.7 ? 'snowflake' : 'ice'
    return 'snowflake'
  }
  if (isRain.value) return 'raindrop'
  if (isFog.value) return Math.random() < 0.6 ? 'fogwisp' : 'leaf'
  const pool = ['firefly', 'butterfly', 'flower', 'leaf', 'bunny', 'bird']
  if (s === 'spring') return Math.random() < 0.5 ? 'flower' : 'butterfly'
  if (s === 'summer') return Math.random() < 0.5 ? 'butterfly' : 'firefly'
  if (s === 'autumn') return Math.random() < 0.7 ? 'leaf' : 'bird'
  return 'firefly'
}

function spawn(now: number) {
  if (items.value.length >= MAX) return
  const type = pickType()
  items.value.push({
    id: nextId++,
    x: Math.random() * 100,
    y: Math.random() * 100,
    type,
    life: 1,
  })
}

function tick(now: number) {
  if (now - last > SPAWN_INTERVAL) {
    last = now
    spawn(now)
  }
  for (const it of items.value) it.life -= 0.0008
  items.value = items.value.filter((it) => it.life > 0)
}

function loop(now: number) {
  tick(now)
  raf = requestAnimationFrame(loop)
}

function mount() {
  if (raf) return
  raf = requestAnimationFrame(loop)
}
function unmount() {
  if (raf) {
    cancelAnimationFrame(raf)
    raf = null
  }
}

onMounted(mount)
onUnmounted(unmount)
</script>

<template>
  <div class="stardew-flora-fauna" aria-hidden="true">
    <div
      v-for="it in items"
      :key="it.id"
      class="stardew-life"
      :class="it.type"
      :style="{
        left: it.x + '%',
        top: it.y + '%',
        opacity: it.life,
        transform: 'translate(-50%,-50%)',
      }"
    />
    <div v-if="isThunder" class="stardew-lightning" :style="{ animationDuration: THUNDER_FLASH + 'ms' }" />
  </div>
</template>

<style>
.stardew-flora-fauna {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 40;
  overflow: hidden;
}
.stardew-life {
  position: absolute;
  width: 14px;
  height: 14px;
  image-rendering: pixelated;
  transform-origin: center;
  animation: stardew-drift 7s linear infinite;
}
.stardew-life.firefly {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ffd966;
  box-shadow: 0 0 8px 2px #ffc52a;
  animation: stardew-firefly 3.6s ease-in-out infinite;
}
.stardew-life.butterfly {
  width: 16px;
  height: 12px;
  border-radius: 50%;
  background: repeating-linear-gradient(90deg, #ff80ab 0px, #ff80ab 4px, transparent 4px, transparent 8px);
  clip-path: polygon(20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%);
  animation: stardew-wobble 2.2s ease-in-out infinite;
}
.stardew-life.flower {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 30%, #ffffff 0 3px, transparent 3px),
    radial-gradient(circle at 70% 30%, #ffffff 0 3px, transparent 3px),
    radial-gradient(circle at 30% 70%, #ffffff 0 3px, transparent 3px),
    radial-gradient(circle at 70% 70%, #ffffff 0 3px, transparent 3px),
    #ffb6c1;
  box-shadow: 0 0 0 2px #1c7a5a;
}
.stardew-life.leaf {
  width: 13px;
  height: 8px;
  border-radius: 50%;
  background: #5a8c3a;
  transform: rotate(25deg);
  animation: stardew-leaf 8s linear infinite;
}
.stardew-life.bird {
  width: 18px;
  height: 8px;
  border-radius: 50%;
  background: repeating-linear-gradient(180deg, #3a2c20 0px, #3a2c20 2px, transparent 2px, transparent 5px);
  animation: stardew-wobble 1.1s ease-in-out infinite;
}
.stardew-life.bunny {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #f5e6d3;
  box-shadow: 0 0 0 2px #1c7a5a;
}
.stardew-life.raindrop {
  width: 6px;
  height: 10px;
  border-radius: 50%;
  background: #a5d8ff;
  animation: stardew-rain 0.8s linear infinite;
}
.stardew-life.snowflake {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 0 4px 0px #b3e5fc;
  animation: stardew-snow 5s linear infinite;
}
.stardew-life.ice {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: #e0f7fa;
  box-shadow: 0 0 6px 0px #80deea;
  transform: rotate(30deg);
}
.stardew-life.lightning {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(255, 250, 120, 0.85);
  box-shadow: 0 0 24px 8px rgba(255, 240, 70, 0.8);
}
.stardew-life.fogwisp {
  width: 40px;
  height: 14px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.55);
  box-shadow: 0 0 18px 4px rgba(255, 255, 255, 0.35);
}

.stardew-lightning {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: rgba(255, 255, 240, 0.18);
  animation: stardew-flash-thunder 1s steps(2, end) infinite;
}

@keyframes stardew-drift {
  0% { transform: translate(-50%,-50%) translate(0,0); }
  25% { transform: translate(-50%,-50%) translate(28px,-18px); }
  50% { transform: translate(-50%,-50%) translate(-16px,12px); }
  75% { transform: translate(-50%,-50%) translate(10px,20px); }
  100% { transform: translate(-50%,-50%) translate(0,0); }
}
@keyframes stardew-firefly {
  0% { opacity: 0.2; transform: translate(-50%,-50%) translate(0,0) scale(0.9); }
  55% { opacity: 0.9; transform: translate(-50%,-50%) translate(10px,-8px) scale(1.15); }
  100% { opacity: 0.35; transform: translate(-50%,-50%) translate(-6px,10px) scale(0.95); }
}
@keyframes stardew-wobble {
  0% { transform: translate(-50%,-50%) rotate(0deg); }
  50% { transform: translate(-50%,-50%) rotate(18deg); }
  100% { transform: translate(-50%,-50%) rotate(0deg); }
}
@keyframes stardew-leaf {
  0% { transform: translate(-50%,-50%) translate(-20px,-10px) rotate(0deg); opacity: 0.7; }
  100% { transform: translate(-50%,-50%) translate(60px,110px) rotate(240deg); opacity: 0.05; }
}
@keyframes stardew-rain {
  0% { transform: translate(-50%,-50%) translate(0,0); opacity: 0.9; }
  100% { transform: translate(-50%,-50%) translate(-6px,110px); opacity: 0; }
}
@keyframes stardew-snow {
  0% { transform: translate(-50%,-50%) translate(0,0); opacity: 0.9; }
  100% { transform: translate(-50%,-50%) translate(10px,110px); opacity: 0; }
}
@keyframes stardew-flash-thunder {
  0% { opacity: 0; }
  10% { opacity: 1; }
  20% { opacity: 0; }
  35% { opacity: 0.7; }
  50% { opacity: 0; }
  100% { opacity: 0; }
}
</style>
