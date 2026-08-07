<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import PixelProgress from '@/components/PixelProgress.vue'
import { useNodePingDisplay } from '@/composables/useNodePingDisplay'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig } from '@/utils/helper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { getDaysUntilExpired, getExpireStatus } from '@/utils/tagHelper'

const props = defineProps<{ node: NodeData }>()
const emit = defineEmits<{ click: [] }>()
const appStore = useAppStore()

const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, appStore.byteDecimals)
const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, appStore.byteDecimals)

const memPercentage = computed(() => (props.node.ram ?? 0) / (props.node.mem_total || 1) * 100)
const diskPercentage = computed(() => (props.node.disk ?? 0) / (props.node.disk_total || 1) * 100)

const loadPct = computed(() => {
  const cores = Math.max(props.node.cpu_cores ?? 1, 1)
  return Math.min(((props.node.load ?? 0) / cores) * 100, 100)
})

const {
  latencyDisplay,
  lossDisplay,
  latencyPanelTooltip,
  lossPanelTooltip,
  pingStats,
} = useNodePingDisplay(() => props.node.uuid)

function pingDotClass(value: number | null | undefined): string {
  if (value === null || value === undefined)
    return 'ping-dot'
  if (value <= 60)
    return 'ping-dot ping-dot--active'
  if (value <= 160)
    return 'ping-dot ping-dot--warn'
  return 'ping-dot ping-dot--bad'
}

function lossDotClass(value: number | null | undefined): string {
  if (value === null || value === undefined)
    return 'ping-dot'
  if (value <= 1)
    return 'ping-dot ping-dot--active'
  if (value <= 6)
    return 'ping-dot ping-dot--warn'
  return 'ping-dot ping-dot--bad'
}

const expiresDays = computed(() => {
  if (!props.node.expired_at)
    return null
  const status = getExpireStatus(props.node.expired_at)
  if (status === 'long_term')
    return null
  if (status === 'expired')
    return 0
  return getDaysUntilExpired(props.node.expired_at)
})

const uptimeDays = computed(() => {
  const sec = props.node.uptime ?? 0
  return Math.floor(sec / 86400)
})

const osLabel = computed(() => {
  const os = getOSName(props.node.os) || props.node.os || '-'
  const arch = props.node.arch || ''
  const virt = props.node.virtualization || ''
  return [os, arch, virt].filter(Boolean).join(' · ')
})

interface BannerTheme {
  key: string
  banner: string
  building: string
}

const themes: readonly BannerTheme[] = [
  {
    key: 'green',
    banner: '#4caf50',
    building: '/images/card/building/cottage-red.png',
  },
  {
    key: 'blue',
    banner: '#42a5f5',
    building: '/images/card/building/cottage-blue.png',
  },
  {
    key: 'purple',
    banner: '#7e57c2',
    building: '/images/card/building/tower-stone.png',
  },
  {
    key: 'pink',
    banner: '#ec407a',
    building: '/images/card/building/coop.png',
  },
  {
    key: 'orange',
    banner: '#ff9800',
    building: '/images/card/building/barn-wooden.png',
  },
  {
    key: 'teal',
    banner: '#26a69a',
    building: '/images/card/building/windmill-wood.png',
  },
]

const theme = computed<BannerTheme>(() => {
  const name = props.node.name || ''
  let hash = 0
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return themes[hash % themes.length]!
})

// ===== 星露谷农场装饰：屋旁随机动物 + 石子 + 花草（确定性随机，基于节点名） =====
const FARM_ANIMALS = [
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

const FARM_GRASS = [
  '/images/icons/grass/clump-r0-c0.png',
  '/images/icons/grass/clump-r0-c1.png',
  '/images/icons/grass/clump-r1-c0.png',
  '/images/icons/grass/clump-r1-c1.png',
  '/images/icons/grass/clump-r2-c0.png',
  '/images/icons/grass/clump-r2-c1.png',
]

interface FarmDecor {
  animal: string
  animalSide: 'left' | 'right'
  animalScale: number
  stones: { img: string, x: number, y: number, scale: number, flip: boolean }[]
  grass: { img: string, x: number, y: number, scale: number, flip: boolean }[]
}

const farmDecor = computed<FarmDecor>(() => {
  const name = props.node.name || ''
  let h = 0
  for (let i = 0; i < name.length; i++)
    h = (h * 31 + name.charCodeAt(i)) >>> 0
  // 独立于 theme hash 的派生随机（同节点每次渲染一致）
  const pick = <T,>(arr: readonly T[], salt: number): T => arr[(h + salt) % arr.length]!

  const decor: FarmDecor = {
    animal: pick(FARM_ANIMALS, 7),
    animalSide: (h >> 3) % 2 === 0 ? 'left' : 'right',
    animalScale: 0.55 + ((h >> 4) % 5) * 0.08, // 0.55-0.87
    stones: [],
    grass: [],
  }

  // 2-3 颗石子
  const stoneCount = 2 + (h % 2)
  for (let i = 0; i < stoneCount; i++) {
    decor.stones.push({
      img: '/images/icons/stone.png',
      x: -30 + ((h + i * 13) % 60), // -30% ~ 30% 相对屋子的偏移
      y: 0,
      scale: 0.7 + ((h >> (2 + i)) % 4) * 0.15,
      flip: ((h >> (3 + i)) % 2) === 1,
    })
  }

  // 2-3 棵花草
  const grassCount = 2 + ((h >> 2) % 2)
  for (let i = 0; i < grassCount; i++) {
    decor.grass.push({
      img: pick(FARM_GRASS, 11 + i * 5),
      x: -36 + ((h + i * 29) % 72),
      y: 0,
      scale: 0.7 + ((h >> (1 + i)) % 4) * 0.15,
      flip: ((h >> (4 + i)) % 2) === 1,
    })
  }
  return decor
})

// 统一资源进度条与数值颜色（所有节点一致，不随主题变）
const SD_BAR = {
  cpu: '#42a5f5',
  mem: '#66bb6a',
  disk: '#ef5350',
  load: '#ffb74d',
}

function hasRegion(region: string | null | undefined): boolean {
  return Boolean(region?.trim())
}

const offline = computed(() => !props.node.online)
</script>

<template>
  <div
    class="sd-card"
    :class="cn(offline && 'sd-card--offline')"
    @click="emit('click')"
  >
    <!-- 四角花朵装饰（像素素材，PDF 对齐） -->
    <img src="/images/card/corner/tl.png" alt="" aria-hidden="true" class="sd-corner sd-corner--tl">
    <img src="/images/card/corner/tr.png" alt="" aria-hidden="true" class="sd-corner sd-corner--tr">
    <img src="/images/card/corner/bl.png" alt="" aria-hidden="true" class="sd-corner sd-corner--bl">
    <img src="/images/card/corner/br.png" alt="" aria-hidden="true" class="sd-corner sd-corner--br">

    <!-- PDF 式卡片顶部：独立小建筑 + 像素瓦片屋顶 + 名牌横幅 -->
    <div class="sd-top">
      <!-- 第1层：顶饰建筑（像素小屋/谷仓/风车，透明素材） -->
      <div class="sd-top__house">
        <img :src="theme.building" alt="" aria-hidden="true">
      </div>

      <!-- 农场装饰：屋旁随机动物 + 石子 + 花草（确定性随机） -->
      <div class="sd-farm" aria-hidden="true">
        <!-- 屋旁动物 -->
        <img
          :src="farmDecor.animal" alt=""
          class="sd-farm__animal"
          :class="farmDecor.animalSide === 'right' ? 'sd-farm__animal--right' : ''"
          :style="{ transform: `scale(${farmDecor.animalScale})${farmDecor.animalSide === 'right' ? ' scaleX(-1)' : ''}` }"
        >
        <!-- 石子 -->
        <img
          v-for="(s, i) in farmDecor.stones" :key="'s' + i"
          :src="s.img" alt=""
          class="sd-farm__stone"
          :style="{ left: `calc(50% + ${s.x}%)`, transform: `scale(${s.scale})${s.flip ? ' scaleX(-1)' : ''}` }"
        >
        <!-- 花草 -->
        <img
          v-for="(g, i) in farmDecor.grass" :key="'g' + i"
          :src="g.img" alt=""
          class="sd-farm__grass"
          :style="{ left: `calc(50% + ${g.x}%)`, transform: `scale(${g.scale})${g.flip ? ' scaleX(-1)' : ''}` }"
        >
      </div>

      <!-- 第2层：像素瓦片坡屋顶 → 移除（建筑自带屋顶，避免砖块金字塔观感） -->

      <!-- 第3层：名牌横板（木质标牌素材 + 服务器名 + 国旗） -->
      <div class="sd-banner">
        <img src="/images/card/sign-banner.png" alt="" aria-hidden="true" class="sd-banner__board">
        <span class="sd-banner__name">{{ props.node.name }}</span>
        <img
          v-if="hasRegion(props.node.region)"
          :src="`/images/flags/${getRegionCode(props.node.region)}.svg`"
          :alt="getRegionDisplayName(props.node.region)"
          class="sd-banner__flag"
        >
      </div>
    </div>

    <!-- online status dot -->
    <span class="sd-status" :class="offline ? 'sd-status--off' : 'sd-status--on'" />

    <!-- OS line -->
    <div class="sd-os">
      <img :src="getOSImage(props.node.os)" :alt="getOSName(props.node.os)" class="sd-os__icon">
      <span class="sd-os__text">{{ osLabel }}</span>
    </div>

    <!-- resource 2x2 -->
    <div class="sd-grid">
      <div class="sd-metric">
        <div class="sd-metric__head">
          <span class="sd-metric__label">
            <img src="/images/card/icon-cpu.png" alt="" aria-hidden="true" class="sd-metric__icon">
            CPU
          </span>
          <b class="sd-metric__val sd-metric__val--cpu">{{ (props.node.cpu ?? 0).toFixed(0) }}%</b>
        </div>
        <PixelProgress :percentage="props.node.cpu ?? 0" :color="SD_BAR.cpu" />
      </div>

      <div class="sd-metric">
        <div class="sd-metric__head">
          <span class="sd-metric__label">
            <img src="/images/card/icon-memory.png" alt="" aria-hidden="true" class="sd-metric__icon">
            Memory
          </span>
          <b class="sd-metric__val sd-metric__val--mem">{{ memPercentage.toFixed(1) }}%</b>
        </div>
        <PixelProgress :percentage="memPercentage" :color="SD_BAR.mem" />
      </div>

      <div class="sd-metric">
        <div class="sd-metric__head">
          <span class="sd-metric__label">
            <img src="/images/card/icon-disk.png" alt="" aria-hidden="true" class="sd-metric__icon">
            Disk
          </span>
          <b class="sd-metric__val sd-metric__val--disk">{{ diskPercentage.toFixed(1) }}%</b>
        </div>
        <PixelProgress :percentage="diskPercentage" :color="SD_BAR.disk" />
      </div>

      <div class="sd-metric">
        <div class="sd-metric__head">
          <span class="sd-metric__label">
            <img src="/images/card/icon-load.png" alt="" aria-hidden="true" class="sd-metric__icon">
            Load
          </span>
          <b class="sd-metric__val sd-metric__val--load">{{ (props.node.load ?? 0).toFixed(2) }}</b>
        </div>
        <PixelProgress :percentage="loadPct" :color="SD_BAR.load" />
      </div>
    </div>

    <!-- upload / download -->
    <div class="sd-row sd-row--speed">
      <div class="sd-pair">
        <span class="sd-pair__label">
          <img src="/images/card/icon-up.png" alt="" aria-hidden="true" class="sd-pair__icon c-sky">
          Upload
        </span>
        <span class="sd-pair__val c-sky">{{ formatBytesPerSecond(props.node.net_out ?? 0) }}</span>
      </div>
      <div class="sd-pair">
        <span class="sd-pair__label">
          <img src="/images/card/icon-down.png" alt="" aria-hidden="true" class="sd-pair__icon c-em">
          Download
        </span>
        <span class="sd-pair__val c-em">{{ formatBytesPerSecond(props.node.net_in ?? 0) }}</span>
      </div>
    </div>

    <!-- outbound / inbound totals -->
    <div class="sd-row sd-row--traffic">
      <div class="sd-pair">
        <span class="sd-pair__label">
          <Icon icon="mdi:earth" width="12" height="12" class="c-sky" />
          Outbound
        </span>
        <span class="sd-pair__val c-sky">{{ formatBytes(props.node.net_total_up ?? 0) }}</span>
      </div>
      <div class="sd-pair">
        <span class="sd-pair__label">
          <Icon icon="mdi:earth" width="12" height="12" class="c-em" />
          Inbound
        </span>
        <span class="sd-pair__val c-em">{{ formatBytes(props.node.net_total_down ?? 0) }}</span>
      </div>
    </div>

    <!-- latency / packet loss -->
    <div class="sd-row sd-row--ping" :class="offline && 'is-dim'">
      <div class="sd-ping" :title="latencyPanelTooltip">
        <div class="sd-ping__head">
          <span class="sd-pair__label">
            <Icon icon="mdi:clock-outline" width="12" height="12" />
            Latency
          </span>
          <b class="sd-metric__val c-rose">{{ latencyDisplay }}</b>
        </div>
        <div class="ping-bar">
          <span
            v-for="i in 8"
            :key="`lat-${i}`"
            :class="pingDotClass(pingStats.hasData ? pingStats.history.value[Math.min(i - 1, Math.max(pingStats.history.value.length - 1, 0))]?.latency : undefined)"
          />
        </div>
      </div>
      <div class="sd-ping" :title="lossPanelTooltip">
        <div class="sd-ping__head">
          <span class="sd-pair__label">
            <Icon icon="mdi:shield-check" width="12" height="12" class="c-em" />
            Packet Loss
          </span>
          <b class="sd-metric__val c-em">{{ lossDisplay }}</b>
        </div>
        <div class="ping-bar">
          <span
            v-for="i in 8"
            :key="`loss-${i}`"
            :class="lossDotClass(pingStats.hasData ? pingStats.history.value[Math.min(i - 1, Math.max(pingStats.history.value.length - 1, 0))]?.loss : undefined)"
          />
        </div>
      </div>
    </div>

    <!-- expires / uptime -->
    <div class="sd-row sd-row--footer">
      <div class="sd-pair">
        <span class="sd-pair__label">
          <Icon icon="mdi:calendar" width="12" height="12" class="c-rose" />
          Expires
        </span>
        <span class="sd-pair__val c-rose">
          <template v-if="expiresDays === null">∞</template>
          <template v-else>{{ expiresDays }} days</template>
        </span>
      </div>
      <div v-if="appStore.showNodeUptime" class="sd-pair">
        <span class="sd-pair__label">
          <Icon icon="mdi:timer-sand" width="12" height="12" class="c-em" />
          Uptime
        </span>
        <span class="sd-pair__val c-em">{{ uptimeDays }} days</span>
      </div>
    </div>

    <!-- bottom-right flower -->
    <div class="sd-flower">
      <Icon icon="mdi:flower-tulip" width="18" height="18" :style="{ color: theme.banner }" />
    </div>
  </div>
</template>

<style scoped>
.sd-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-height: 280px;
  padding: 14px 14px 12px;
  cursor: pointer;
  background: linear-gradient(180deg, #fbf3dc 0%, #f3e2bd 55%, #ecd7a6 100%);
  border: 20px solid transparent;
  border-image: url('/images/card/frame-slice.png') 64 round;
  /* 直角像素木框（对齐 PDF 星露谷对话框，非圆角） */
  border-radius: 0;
  box-shadow:
    5px 5px 0 #3e2723,
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
  color: #3a2a1a;
  font-family: 'VT323', 'Press Start 2P', 'Nunito', system-ui, sans-serif;
  letter-spacing: 0.02em;
  transition:
    transform 120ms ease,
    box-shadow 120ms ease;
  overflow: visible;
  image-rendering: auto;
}

.sd-card:hover {
  transform: translate(-2px, -2px);
  box-shadow:
    6px 6px 0 #3e2723,
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

/* 四角花朵装饰（像素素材，对齐 PDF 卡片四角花朵） */
.sd-corner {
  position: absolute;
  width: 62px;
  height: 62px;
  object-fit: contain;
  image-rendering: pixelated;
  pointer-events: none;
  z-index: 5;
  opacity: 0.92;
  filter: drop-shadow(1px 2px 0 rgba(62, 39, 35, 0.18));
}
/* 素材初始方向：L 形转角在左下（垂直茎左、水平藤蔓底） */
.sd-corner--tl {
  top: -8px;
  left: -8px;
  transform: rotate(90deg);
}
.sd-corner--tr {
  top: -8px;
  right: -8px;
  transform: rotate(180deg);
}
.sd-corner--bl {
  bottom: -8px;
  left: -8px;
  transform: rotate(0deg);
}
.sd-corner--br {
  bottom: -8px;
  right: -8px;
  transform: rotate(270deg);
}

.sd-card--offline {
  filter: grayscale(0.35) brightness(0.95) contrast(1.1);
  border-color: #7a3b2a;
  box-shadow: 4px 4px 0 #5a2417;
}

.sd-status {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #3e2723;
  z-index: 3;
}
.sd-status--on {
  background: #4caf50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.35);
}
.sd-status--off {
  background: #e53935;
}

/* ===== PDF 式卡片顶部：小建筑（自带屋顶）+ 木质名牌 ===== */
.sd-top {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 2px;
}

/* 第1层：顶饰建筑（像素小屋/谷仓/风车，自带屋顶） */
.sd-top__house {
  position: relative;
  z-index: 4;
  margin-bottom: -2px;
  margin-top: -4px;
  filter: drop-shadow(2px 3px 0 rgba(62, 39, 35, 0.3));
}
.sd-top__house img {
  display: block;
  height: 64px;
  width: auto;
  max-width: 92px;
  object-fit: contain;
  image-rendering: pixelated;
  pointer-events: none;
}

/* ===== 农场装饰层：屋旁动物 + 石子 + 花草 ===== */
.sd-farm {
  position: relative;
  z-index: 3;
  height: 0;
  width: 100%;
  pointer-events: none;
}
/* 动物：站在屋子旁边，脚对齐横幅上沿 */
.sd-farm__animal {
  position: absolute;
  bottom: -6px;
  left: 50%;
  margin-left: 46px; /* 屋子右侧 */
  max-height: 40px;
  max-width: 44px;
  object-fit: contain;
  image-rendering: pixelated;
  transform-origin: bottom center;
}
.sd-farm__animal--right {
  margin-left: -90px; /* 屋子左侧（镜像后视觉在左） */
}
/* 石子：散落在屋子脚下 */
.sd-farm__stone {
  position: absolute;
  bottom: -8px;
  height: auto;
  width: 26px;
  object-fit: contain;
  image-rendering: pixelated;
  transform-origin: bottom center;
}
/* 花草：簇拥在屋子两侧 */
.sd-farm__grass {
  position: absolute;
  bottom: -9px;
  height: auto;
  width: 34px;
  object-fit: contain;
  image-rendering: pixelated;
  transform-origin: bottom center;
}

/* 第3层：名牌横幅（木质标牌素材） */
.sd-banner {
  position: relative;
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 58%;
  max-width: 86%;
  margin-top: -4px;
  z-index: 2;
  /* 去掉旧 CSS 直角背景，改由素材铺底 */
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 6px 22px 8px;
}

/* 木质标牌素材铺底 */
.sd-banner__board {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  image-rendering: pixelated;
  pointer-events: none;
}

/* 名牌文字：深棕色（木牌上可读，对齐 PDF 木牌文字） */
.sd-banner__name {
  position: relative;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
  color: #3d2b1f;
  text-shadow: 0 1px 0 rgba(255, 245, 220, 0.55);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
  letter-spacing: 0.04em;
}

/* 国旗：放在名字右侧 */
.sd-banner__flag {
  position: relative;
  height: 13px;
  width: auto;
  max-width: 19px;
  object-fit: contain;
  border-radius: 1px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.18);
  image-rendering: auto;
}

.sd-os {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #5c3a1e;
  opacity: 0.9;
  min-width: 0;
}
.sd-os__icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.sd-os__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sd-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}

.sd-metric {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.sd-metric__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.sd-metric__label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: #5c3a1e;
  opacity: 0.9;
}
.sd-metric__val {
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
/* 像素指标图标（统一素材，不随主题） */
.sd-metric__icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
  image-rendering: pixelated;
  pointer-events: none;
  flex-shrink: 0;
}
/* 网速方向像素箭头 */
.sd-pair__icon {
  width: 12px;
  height: 12px;
  object-fit: contain;
  image-rendering: pixelated;
  pointer-events: none;
  flex-shrink: 0;
}
/* 统一资源数值颜色（与进度条一致，所有节点相同） */
.sd-metric__val--cpu {
  color: #42a5f5;
}
.sd-metric__val--mem {
  color: #66bb6a;
}
.sd-metric__val--disk {
  color: #ef5350;
}
.sd-metric__val--load {
  color: #ffb74d;
}

.sd-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}

.sd-pair {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.sd-pair__label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #5c3a1e;
  opacity: 0.85;
}
.sd-pair__val {
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}

.sd-ping {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.sd-ping__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.ping-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 8px;
}
.ping-dot {
  width: 8px;
  height: 8px;
  border-radius: 1px;
  background: rgba(62, 39, 35, 0.12);
  border: 1px solid rgba(62, 39, 35, 0.2);
}
.ping-dot--active {
  /* 柔和星露谷草绿：正常态低调不刺眼（黄/红警示色保持醒目） */
  background: #8bc34a;
  border-color: #6d9e37;
}
.ping-dot--warn {
  background: #e6a23c;
  border-color: #c4841c;
}
.ping-dot--bad {
  background: #d14c4c;
  border-color: #a83232;
}

.sd-row--footer {
  margin-top: 2px;
  padding-top: 6px;
  border-top: 1px dashed rgba(107, 68, 35, 0.35);
}

.sd-flower {
  position: absolute;
  right: 6px;
  bottom: 4px;
  opacity: 0.85;
  pointer-events: none;
  filter: drop-shadow(1px 1px 0 rgba(62, 39, 35, 0.2));
}

.is-dim {
  opacity: 0.5;
}

.c-sky {
  color: #0288d1;
}
.c-em {
  color: #2e7d32;
}
.c-rose {
  color: #c62828;
}
</style>
