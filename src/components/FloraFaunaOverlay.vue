<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
// 生态/天气精灵:AI 生成的像素 sprite(1px 深棕描边 + 受限调色板),
// 蝴蝶 / 花 / 叶 各有四季变体(逐色单独生成,不做色相旋转改色)
import birdUrl from '@/assets/pixel-sprites/bird.png'
import bunnyUrl from '@/assets/pixel-sprites/bunny.png'
import butterflyAutumnUrl from '@/assets/pixel-sprites/butterfly-autumn.png'
import butterflySpringUrl from '@/assets/pixel-sprites/butterfly-spring.png'
import butterflySummerUrl from '@/assets/pixel-sprites/butterfly-summer.png'
import butterflyWinterUrl from '@/assets/pixel-sprites/butterfly-winter.png'
import cloudUrl from '@/assets/pixel-sprites/cloud.png'
import fireflyUrl from '@/assets/pixel-sprites/firefly.png'
import flowerAutumnUrl from '@/assets/pixel-sprites/flower-autumn.png'
import flowerSpringUrl from '@/assets/pixel-sprites/flower-spring.png'
import flowerSummerUrl from '@/assets/pixel-sprites/flower-summer.png'
import flowerWinterUrl from '@/assets/pixel-sprites/flower-winter.png'
import fogwispUrl from '@/assets/pixel-sprites/fogwisp.png'
import iceUrl from '@/assets/pixel-sprites/ice.png'
import leafAutumnUrl from '@/assets/pixel-sprites/leaf-autumn.png'
import leafSpringUrl from '@/assets/pixel-sprites/leaf-spring.png'
import leafSummerUrl from '@/assets/pixel-sprites/leaf-summer.png'
import leafWinterUrl from '@/assets/pixel-sprites/leaf-winter.png'
import lightningUrl from '@/assets/pixel-sprites/lightning.png'
import raindropUrl from '@/assets/pixel-sprites/raindrop.png'
import snowflakeUrl from '@/assets/pixel-sprites/snowflake.png'
import starUrl from '@/assets/pixel-sprites/star.png'
import { isFog, isNight, isRain, isSnow, isThunder, season } from '@/composables/useStardewAtmosphere'

interface LifeItem {
  id: number
  x: number
  y: number
  type: string
  life: number
  vx: number
  vy: number
}

const items = ref<LifeItem[]>([])
let nextId = 0
const MAX = 18
let raf: number | null = null
let spawnAcc = 0
const SPAWN_EVERY_MS = 1100
let lastTs = 0

const SPRITES: Record<string, string> = {
  firefly: fireflyUrl,
  bird: birdUrl,
  bunny: bunnyUrl,
  raindrop: raindropUrl,
  snowflake: snowflakeUrl,
  ice: iceUrl,
  fogwisp: fogwispUrl,
  lightning: lightningUrl,
  star: starUrl,
  cloud: cloudUrl,
}

/** 季节变体:同一个 type 在四季用不同颜色(逐色生成的独立素材) */
const SEASONAL: Record<string, Record<string, string>> = {
  butterfly: {
    spring: butterflySpringUrl,
    summer: butterflySummerUrl,
    autumn: butterflyAutumnUrl,
    winter: butterflyWinterUrl,
  },
  flower: {
    spring: flowerSpringUrl,
    summer: flowerSummerUrl,
    autumn: flowerAutumnUrl,
    winter: flowerWinterUrl,
  },
  leaf: {
    spring: leafSpringUrl,
    summer: leafSummerUrl,
    autumn: leafAutumnUrl,
    winter: leafWinterUrl,
  },
}

/** 按当前季节取精灵图;没有季节变体的直接用单张 */
function spriteOf(type: string): string {
  // 兜底用直接导入的常量(索引取值在 noUncheckedIndexedAccess 下是 string | undefined)
  const fallback: string = cloudUrl
  const bySeason = SEASONAL[type]
  if (bySeason)
    return bySeason[season.value] ?? bySeason.spring ?? fallback
  return SPRITES[type] ?? fallback
}

function pickType(): string {
  const s = season.value
  if (isThunder.value) {
    const p = Math.random()
    if (p < 0.2)
      return 'lightning'
    if (p < 0.4)
      return 'cloud'
    return 'raindrop'
  }
  if (isSnow.value || s === 'winter') {
    const p = Math.random()
    if (p < 0.12)
      return 'star'
    if (p < 0.22)
      return 'cloud'
    if (isSnow.value)
      return Math.random() < 0.7 ? 'snowflake' : 'ice'
    return Math.random() < 0.5 ? 'snowflake' : 'cloud'
  }
  if (isRain.value) {
    return Math.random() < 0.18 ? 'cloud' : 'raindrop'
  }
  if (isFog.value) {
    const p = Math.random()
    if (p < 0.4)
      return 'fogwisp'
    if (p < 0.6)
      return 'cloud'
    return 'leaf'
  }
  if (isNight.value) {
    const p = Math.random()
    if (p < 0.45)
      return 'star'
    if (p < 0.7)
      return 'firefly'
    return 'cloud'
  }
  // Clear daytime animals / plants
  if (s === 'spring')
    return Math.random() < 0.55 ? 'flower' : (Math.random() < 0.6 ? 'butterfly' : 'bunny')
  if (s === 'summer')
    return Math.random() < 0.45 ? 'butterfly' : (Math.random() < 0.5 ? 'firefly' : 'bird')
  if (s === 'autumn')
    return Math.random() < 0.65 ? 'leaf' : 'bird'
  return 'firefly'
}

function spawn() {
  if (items.value.length >= MAX)
    return
  const type = pickType()
  const fromTop = type === 'raindrop' || type === 'snowflake' || type === 'ice' || type === 'leaf'
  items.value.push({
    id: nextId++,
    x: Math.random() * 100,
    y: fromTop ? Math.random() * 25 : 55 + Math.random() * 35,
    type,
    life: 1,
    vx: (Math.random() - 0.5) * 0.04,
    vy: fromTop ? 0.04 + Math.random() * 0.06 : (Math.random() - 0.5) * 0.02,
  })
}

function tick(dt: number) {
  for (const it of items.value) {
    it.life -= dt * 0.00012
    it.x += it.vx * dt
    it.y += it.vy * dt
    if (it.type === 'butterfly' || it.type === 'bird' || it.type === 'firefly') {
      it.vx += (Math.random() - 0.5) * 0.002
      it.vy += (Math.random() - 0.5) * 0.001
    }
  }
  items.value = items.value.filter(it => it.life > 0 && it.y < 110 && it.x > -5 && it.x < 105)
}

function loop(ts: number) {
  if (!lastTs)
    lastTs = ts
  const dt = Math.min(ts - lastTs, 64)
  lastTs = ts
  spawnAcc += dt
  while (spawnAcc >= SPAWN_EVERY_MS) {
    spawn()
    spawnAcc -= SPAWN_EVERY_MS
  }
  tick(dt)
  raf = requestAnimationFrame(loop)
}

onMounted(() => {
  for (let i = 0; i < 6; i++)
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
        left: `${it.x}%`,
        top: `${it.y}%`,
        opacity: Math.max(0, it.life),
        backgroundImage: `url(${spriteOf(it.type)})`,
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
  width: 16px;
  height: 16px;
  image-rendering: pixelated;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  transform: translate(-50%, -50%);
  will-change: transform, opacity;
}
.stardew-life.flower,
.stardew-life.bunny {
  width: 18px;
  height: 18px;
}
.stardew-life.butterfly {
  width: 20px;
  height: 16px;
  animation: stardew-wobble 2.2s ease-in-out infinite;
}
.stardew-life.bird {
  width: 22px;
  height: 16px;
}
.stardew-life.firefly {
  width: 12px;
  height: 12px;
  filter: drop-shadow(0 0 4px rgba(255, 230, 120, 0.8));
  animation: stardew-twinkle 1.8s ease-in-out infinite;
}
.stardew-life.leaf {
  width: 14px;
  height: 14px;
  animation: stardew-leaf-spin 6s linear infinite;
}
.stardew-life.raindrop {
  width: 8px;
  height: 14px;
  opacity: 0.7 !important;
}
.stardew-life.snowflake,
.stardew-life.ice {
  width: 12px;
  height: 12px;
}
.stardew-life.fogwisp {
  width: 48px;
  height: 20px;
  opacity: 0.5 !important;
}
.stardew-life.star {
  width: 10px;
  height: 10px;
  animation: stardew-twinkle 2.4s ease-in-out infinite;
}
.stardew-life.cloud {
  width: 36px;
  height: 16px;
  opacity: 0.8 !important;
}
.stardew-life.lightning {
  width: 28px;
  height: 28px;
}
.stardew-lightning {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: rgba(255, 255, 240, 0.18);
  animation: stardew-flash-thunder 2.8s steps(2, end) infinite;
}

@keyframes stardew-twinkle {
  0%,
  100% {
    opacity: 0.45;
    transform: translate(-50%, -50%) scale(0.9);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.25);
  }
}
@keyframes stardew-wobble {
  0% {
    transform: translate(-50%, -50%) rotate(-8deg);
  }
  50% {
    transform: translate(-50%, -50%) rotate(12deg);
  }
  100% {
    transform: translate(-50%, -50%) rotate(-8deg);
  }
}
@keyframes stardew-leaf-spin {
  0% {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  100% {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}
@keyframes stardew-flash-thunder {
  0%,
  100% {
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  12% {
    opacity: 0;
  }
  18% {
    opacity: 0.6;
  }
  22% {
    opacity: 0;
  }
}
</style>
