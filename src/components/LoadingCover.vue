<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const isDark = computed(() => appStore.isDark)

/** 可随机出现的动物素材（官方星露谷风格） */
const ANIMALS = [
  '/images/animals/chicken-white.png',
  '/images/animals/chicken-brown.png',
  '/images/animals/chick-yellow.png',
  '/images/animals/hen-tan.png',
  '/images/animals/rooster-white.png',
  '/images/animals/calf-brown.png',
  '/images/animals/calf-stand.png',
  '/images/animals/cow-bw.png',
  '/images/animals/lamb-white.png',
  '/images/animals/sheep-black.png',
  '/images/animals/sheep-cream.png',
  '/images/animals/squirrel-sit.png',
  '/images/animals/squirrel-run.png',
  '/images/animals/butterfly-blue.png',
  '/images/animals/butterfly-orange.png',
  '/images/animals/butterfly-purple.png',
]

/** 草地草簇素材（随机摆放） */
const GRASS_CLUMPS = [
  '/images/icons/grass/clump-r0-c0.png',
  '/images/icons/grass/clump-r0-c1.png',
  '/images/icons/grass/clump-r1-c0.png',
  '/images/icons/grass/clump-r1-c1.png',
]

/** 随机取一个动物 */
const animal = ref(ANIMALS[Math.floor(Math.random() * ANIMALS.length)])

/** 底部草地装饰：随机 6-8 棵草簇 + 2-3 颗石子 */
interface SceneryItem {
  img: string
  x: number
  size: number
  delay: number
  flip: boolean
  z: number
}

const scenery = ref<SceneryItem[]>([])

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

onMounted(() => {
  const items: SceneryItem[] = []
  const clumpCount = 7 + Math.floor(Math.random() * 3) // 7-9 棵草
  const stoneCount = 2 + Math.floor(Math.random() * 2) // 2-3 颗石子
  for (let i = 0; i < clumpCount; i++) {
    const clump = GRASS_CLUMPS[Math.floor(Math.random() * GRASS_CLUMPS.length)]
    if (!clump) continue
    items.push({
      img: clump,
      x: rand(2, 90),
      size: rand(28, 44),
      delay: rand(0, 2),
      flip: Math.random() > 0.5,
      z: 1,
    })
  }
  for (let i = 0; i < stoneCount; i++) {
    items.push({
      img: '/images/icons/stone.png',
      x: rand(5, 88),
      size: rand(20, 30),
      delay: 0,
      flip: false,
      z: 2,
    })
  }
  scenery.value = items.sort((a, b) => a.z - b.z)
})
</script>

<template>
  <div
    class="loading-cover flex items-center justify-center inset-0 fixed z-20 overflow-hidden"
    :class="isDark ? 'bg-[#3a3f4b]' : 'bg-[#8fc9e8]'"
  >
    <!-- 云朵点缀 -->
    <div class="loading-cloud cloud-1" :class="isDark ? 'opacity-30' : 'opacity-60'" />
    <div class="loading-cloud cloud-2" :class="isDark ? 'opacity-25' : 'opacity-50'" />

    <!-- 草地场景 -->
    <div class="loading-scene absolute inset-x-0 bottom-0">
      <div class="loading-grass-base" :class="isDark ? 'bg-[#4a6b3a]' : 'bg-[#6ab04c]'" />
      <img
        v-for="(item, i) in scenery" :key="i"
        :src="item.img" alt=""
        class="loading-scenery-item"
        :class="{ 'loading-stone': item.img.includes('stone'), 'loading-flip': item.flip }"
        :style="{
          left: item.x + '%',
          bottom: '6px',
          width: item.size + 'px',
          height: 'auto',
          animationDelay: item.delay + 's',
        }"
      >
    </div>

    <!-- 中央: 随机动物跳跃 + LOADING -->
    <div class="flex flex-col items-center gap-4 relative z-10">
      <div class="loading-animal-wrap">
        <img :src="animal" alt="LOADING" class="loading-animal" style="image-rendering: pixelated;">
      </div>
      <span
        class="text-sm sm:text-base tracking-[0.3em] font-bold pixel-font"
        :class="isDark ? 'text-[#fbecc8]' : 'text-[#6e4220]'"
      >LOADING</span>
    </div>
  </div>
</template>

<style scoped>
/* ===== 云朵 ===== */
.loading-cloud {
  position: absolute;
  width: 90px;
  height: 30px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 16px;
  image-rendering: pixelated;
}
.loading-cloud::before {
  content: '';
  position: absolute;
  left: 16px;
  top: -14px;
  width: 36px;
  height: 28px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 18px;
}
.loading-cloud::after {
  content: '';
  position: absolute;
  right: 18px;
  top: -9px;
  width: 26px;
  height: 22px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 12px;
}
.cloud-1 {
  left: 12%;
  top: 18%;
  animation: cloud-drift 22s linear infinite;
}
.cloud-2 {
  right: 10%;
  top: 30%;
  transform: scale(0.7);
  animation: cloud-drift 30s linear infinite reverse;
}
@keyframes cloud-drift {
  from { transform: translateX(-40px); }
  to { transform: translateX(60px); }
}

/* ===== 草地场景 ===== */
.loading-scene {
  height: 90px;
}
.loading-grass-base {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  height: 34px;
  border-top: 3px solid rgba(62, 39, 35, 0.55);
}
.loading-scenery-item {
  position: absolute;
  image-rendering: pixelated;
  object-fit: contain;
  animation: grass-sway 3s ease-in-out infinite;
}
.loading-flip {
  animation: grass-sway-flip 3s ease-in-out infinite;
}
.loading-stone {
  animation: none;
}
@keyframes grass-sway {
  0%, 100% { transform: rotate(-1.5deg); }
  50% { transform: rotate(1.5deg); }
}
@keyframes grass-sway-flip {
  0%, 100% { transform: scaleX(-1) rotate(-1.5deg); }
  50% { transform: scaleX(-1) rotate(1.5deg); }
}

/* ===== 动物跳跃 (squash & stretch) ===== */
.loading-animal-wrap {
  width: 110px;
  height: 110px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.loading-animal {
  max-width: 96px;
  max-height: 96px;
  object-fit: contain;
  animation: animal-jump 1.4s cubic-bezier(0.28, 0.84, 0.42, 1) infinite;
  transform-origin: bottom center;
}
@keyframes animal-jump {
  0% {
    transform: translateY(0) scale(1, 1);
  }
  30% {
    transform: translateY(-34px) scale(0.94, 1.08);
  }
  50% {
    transform: translateY(-40px) scale(0.9, 1.12);
  }
  72% {
    transform: translateY(0) scale(1.06, 0.92);
  }
  86% {
    transform: translateY(-6px) scale(1, 1);
  }
  100% {
    transform: translateY(0) scale(1, 1);
  }
}

/* 像素字体提示 */
.pixel-font {
  font-family: 'Silkscreen', 'Courier New', monospace;
  -webkit-font-smoothing: none;
}
</style>
