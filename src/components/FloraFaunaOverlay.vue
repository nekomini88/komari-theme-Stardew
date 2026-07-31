<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { season, isNight, isThunder, isRain, isSnow, isFog } from '@/composables/useStardewAtmosphere'

const items = ref<Array<{ id: number; x: number; y: number; type: string; life: number }>>([])
let nextId = 0
const MAX = 22
let raf: number | null = null
let last = 0
const SPAWN_INTERVAL = 900

const SPRITES: Record<string, string> = {
  firefly: '/src/assets/sprites/firefly.svg',
  butterfly: '/src/assets/sprites/butterfly.svg',
  flower: '/src/assets/sprites/flower.svg',
  leaf: '/src/assets/sprites/leaf.svg',
  bird: '/src/assets/sprites/bird.svg',
  bunny: '/src/assets/sprites/bunny.svg',
  raindrop: '/src/assets/sprites/rain-snow.svg',
  snowflake: '/src/assets/sprites/rain-snow.svg',
  ice: '/src/assets/sprites/ice.svg',
  fogwisp: '/src/assets/sprites/fogwisp.svg',
  lightning: '/src/assets/sprites/fogwisp.svg',
  star: '/src/assets/sprites/star.svg',
  cloud: '/src/assets/sprites/cloud.svg',
}

function pickType() {
  const s = season.value
  if (isThunder.value) {
    const p = Math.random()
    if (p < 0.25) return 'lightning'
    if (p < 0.45) return 'cloud'
    return 'raindrop'
  }
  if (s === 'winter') {
    const p = Math.random()
    if (p < 0.12) return 'star'
    if (p < 0.22) return 'cloud'
    if (isSnow.value) return Math.random() < 0.7 ? 'snowflake' : 'ice'
    return Math.random() < 0.5 ? 'snowflake' : 'cloud'
  }
  if (isRain.value) {
    const p = Math.random()
    if (p < 0.18) return 'cloud'
    return 'raindrop'
  }
  if (isFog.value) {
    const p = Math.random()
    if (p < 0.35) return 'fogwisp'
    if (p < 0.55) return 'cloud'
    return 'leaf'
  }
  const p = Math.random()
  if (p < 0.18) return 'cloud'
  if (isNight.value && p < 0.35) return 'star'
  const pool = ['firefly', 'butterfly', 'flower', 'leaf', 'bunny', 'bird'] as const
  if (s === 'spring') return Math.random() < 0.5 ? 'flower' : 'butterfly'
  if (s === 'summer') return Math.random() < 0.5 ? 'butterfly' : 'firefly'
  if (s === 'autumn') return Math.random() < 0.7 ? 'leaf' : 'bird'
  return 'firefly'
}

function spawn() {
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

function tick() {
  for (const it of items.value) it.life -= 0.0008
  items.value = items.value.filter((it) => it.life > 0)
}

function loop() {
  tick()
  raf = requestAnimationFrame(loop)
}

onMounted(() => {
  spawn()
  raf = requestAnimationFrame(loop)
})
onUnmounted(() => {
  if (raf !== null) {
    cancelAnimationFrame(raf)
    raf = null
  }
})
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
        backgroundImage: 'url(' + (SPRITES[it.type] || '/src/assets/sprites/fogwisp.svg') + ')',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        transform: 'translate(-50%,-50%)',
      }"
    />
    <div v-if="isThunder" class="stardew-lightning" />
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
}
.stardew-life.flower,
.stardew-life.bird,
.stardew-life.bunny,
.stardew-life.firefly {
  animation: stardew-drift 7s linear infinite;
}
.stardew-life.butterfly {
  animation: stardew-wobble 2.2s ease-in-out infinite;
}
.stardew-life.leaf {
  transform: rotate(25deg);
  animation: stardew-leaf 8s linear infinite;
}
.stardew-life.raindrop {
  animation: stardew-rain 0.8s linear infinite;
}
.stardew-life.snowflake,
.stardew-life.ice {
  animation: stardew-snow 5s linear infinite;
}
.stardew-life.lightning {
  width: 24px;
  height: 24px;
  animation: stardew-drift 2s linear infinite;
}
.stardew-life.fogwisp {
  width: 40px;
  height: 16px;
  animation: stardew-fogdrift 10s ease-in-out infinite;
}
.stardew-life.star {
  width: 10px;
  height: 10px;
  animation: stardew-twinkle 2.4s ease-in-out infinite, stardew-drift 9s linear infinite;
}
.stardew-life.cloud {
  width: 28px;
  height: 12px;
  animation: stardew-cloud-drift 22s linear infinite;
  opacity: 0.85;
}
.stardew-lightning {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: rgba(255, 255, 240, 0.18);
  animation: stardew-flash-thunder 1s steps(2, end) infinite;
}

@keyframes stardew-twinkle {
  0%, 100% { opacity: 0.55; transform: translate(-50%,-50%) scale(1); }
  50% { opacity: 1; transform: translate(-50%,-50%) scale(1.35); }
}
@keyframes stardew-cloud-drift {
  0% { transform: translate(-60px, 0); opacity: 0.75; }
  50% { opacity: 0.95; }
  100% { transform: translate(60px, -14px); opacity: 0.75; }
}

@keyframes stardew-drift {
  0% { transform: translate(-50%,-50%) translate(0,0); }
  25% { transform: translate(-50%,-50%) translate(28px,-18px); }
  50% { transform: translate(-50%,-50%) translate(-16px,12px); }
  75% { transform: translate(-50%,-50%) translate(10px,20px); }
  100% { transform: translate(-50%,-50%) translate(0,0); }
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
@keyframes stardew-fogdrift {
  0% { transform: translate(-3%,-1%); }
  50% { transform: translate(3%,1%); }
  100% { transform: translate(-3%,-1%); }
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
