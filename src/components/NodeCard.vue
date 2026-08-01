<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { CardX } from '@/components/ui/card-x'
import { DataTooltip } from '@/components/ui/data-tooltip'
import { useNodePingDisplay } from '@/composables/useNodePingDisplay'
import { useAppStore } from '@/stores/app'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, formatUptimeWithFormat, getStatus } from '@/utils/helper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { formatPriceWithCycle, getDaysUntilExpired, getExpireStatus, parseTags } from '@/utils/tagHelper'
import PixelProgress from '@/components/PixelProgress.vue'

const props = defineProps<{ node: NodeData }>()
const emit = defineEmits<{ click: [] }>()
const appStore = useAppStore()

const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, appStore.byteDecimals)
const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, appStore.byteDecimals)
const formatUptime = (seconds: number) => formatUptimeWithFormat(seconds, 'hour')
const offlineTime = computed(() => formatDateTime(props.node.time))

const cpuStatus = computed(() => getStatus(props.node.cpu ?? 0))
const memPercentage = computed(() => (props.node.ram ?? 0) / (props.node.mem_total || 1) * 100)
const memStatus = computed(() => getStatus(memPercentage.value))
const diskPercentage = computed(() => (props.node.disk ?? 0) / (props.node.disk_total || 1) * 100)
const diskStatus = computed(() => getStatus(diskPercentage.value))

const {
  latencyRenderBars,
  lossRenderBars,
  latencyDisplay,
  lossDisplay,
  latencyPanelTooltip,
  lossPanelTooltip,
  pingStats,
} = useNodePingDisplay(() => props.node.uuid)

const trafficUsedPercentage = computed(() => {
  if (props.node.traffic_limit <= 0) return 0
  const { net_total_up = 0, net_total_down = 0, traffic_limit_type } = props.node
  let used = 0
  switch (traffic_limit_type) {
    case 'up': used = net_total_up; break
    case 'down': used = net_total_down; break
    case 'min': used = Math.min(net_total_up, net_total_down); break
    case 'max': used = Math.max(net_total_up, net_total_down); break
    case 'sum':
    default: used = net_total_up + net_total_down; break
  }
  return Math.min((used / props.node.traffic_limit) * 100, 100)
})

const trafficUsed = computed(() => {
  const { net_total_up = 0, net_total_down = 0, traffic_limit_type } = props.node
  switch (traffic_limit_type) {
    case 'up': return net_total_up
    case 'down': return net_total_down
    case 'min': return Math.min(net_total_up, net_total_down)
    case 'max': return Math.max(net_total_up, net_total_down)
    case 'sum':
    default: return net_total_up + net_total_down
  }
})

const priceTags = computed(() => {
  const tags: Array<string> = []
  const lang = appStore.lang
  const node = props.node
  if (node.price !== 0) {
    const days = getDaysUntilExpired(node.expired_at)
    const status = getExpireStatus(node.expired_at)
    if (status === 'expired') tags.push(lang === 'zh-CN' ? '已过期' : 'Expired')
    else if (status === 'long_term') tags.push(lang === 'zh-CN' ? '长期' : 'Long-term')
    else tags.push(lang === 'zh-CN' ? `剩余 ${days} 天` : `${days} days left`)
    const priceText = formatPriceWithCycle(node.price, node.billing_cycle, node.currency, lang)
    tags.push(priceText)
  }
  return tags
})

const customTags = computed(() => parseTags(props.node.tags).map(t => t.text))

function hasRegion(region: string | null | undefined): boolean {
  return Boolean(region?.trim())
}

type Banner = { bg: string; text: string; decor: string; frame?: string }
const bannerPalette: readonly Banner[] = [
  { bg: '#4caf50', text: '#ffffff', decor: 'solar:scarecrow', frame: 'house' },
  { bg: '#2196f3', text: '#ffffff', decor: 'solar:home-smile', frame: 'flower' },
  { bg: '#9c27b0', text: '#ffffff', decor: 'solar:flower', frame: 'scarecrow' },
  { bg: '#e91e63', text: '#ffffff', decor: 'solar:heart', frame: 'birdhouse' },
  { bg: '#ff9800', text: '#ffffff', decor: 'solar:birdhouse', frame: 'house' },
  { bg: '#009688', text: '#ffffff', decor: 'solar:windmill', frame: 'flower' },
]

const banner = computed<Banner>(() => {
  const idx = Math.abs((props.node.name?.charCodeAt(0) ?? 0) % bannerPalette.length)
  return bannerPalette[idx]!
})
</script>

<template>
  <CardX
    hoverable
    class="node-card w-full cursor-pointer transition-all duration-200"
    :class="[!props.node.online ? '!stardew-wood-card-offline' : 'stardew-node-card']"
    @click="emit('click')"
  >
    <template #header>
      <div class="node-title-wrap">
        <img class="nail" src="/images/icons/nail.png" alt="nail" />
        <div class="node-title" :style="{ backgroundImage: 'url(/images/card/' + (banner.bg === '#4caf50' || banner.bg === '#9c27b0' ? 'title-green' : 'title-blue') + '.png)', backgroundSize: '100% 100%' }">
          <span class="shrink-0 mr-1">
            <Icon :icon="banner.decor" width="14" height="14" />
          </span>
          <span class="text-xs font-bold text-white drop-shadow-sm" style="text-shadow: 0 1px 0 rgba(0,0,0,0.35);">{{ props.node.name }}</span>
          <img
            v-if="hasRegion(props.node.region)"
            :src="`/images/flags/${getRegionCode(props.node.region)}.svg`"
            :alt="getRegionDisplayName(props.node.region)"
            class="h-2.5 w-auto max-w-[18px] shrink-0 object-contain"
            style="image-rendering: auto;"
          >
        </div>
      </div>
    </template>

    <template #default>
      <div class="relative flex flex-col gap-2" style="z-index:1">
        <img class="decor decor-tl" :src="`/images/card/${banner.frame || 'house'}.png`" alt="decor" />
        <img class="decor decor-tr" :src="`/images/card/${banner.frame === 'house' ? 'flower' : banner.frame === 'flower' ? 'scarecrow' : 'house'}.png`" alt="decor" />
        <img class="decor decor-bl" :src="`/images/card/${banner.frame === 'house' ? 'scarecrow' : 'birdhouse'}.png`" alt="decor" />
        <img class="decor decor-br" :src="`/images/card/${banner.frame === 'house' ? 'birdhouse' : 'birdhouse'}.png`" alt="decor" />
        <img class="node-frame-overlay" src="/images/card/node-frame.png" alt="frame" />

        <div class="flex items-center gap-2 text-xs text-[#5c3a1e]">
          <img :src="getOSImage(props.node.os)" :alt="getOSName(props.node.os)" class="size-3.5 shrink-0">
          <span class="truncate">{{ getOSName(props.node.os) }} · {{ props.node.arch }} · {{ props.node.virtualization }}</span>
        </div>

        <div class="resource-grid">
          <div class="resource-item">
            <div class="flex items-center justify-between text-xs text-[#5c3a1e]">
              <div class="flex items-center gap-1">
                <img src="/images/icons/cpu.svg" width="14" height="14" alt="CPU" class="opacity-80 shrink-0">
                <span>CPU</span>
              </div>
              <b class="tabular-nums">{{ (props.node.cpu ?? 0).toFixed(1) }}%</b>
            </div>
            <PixelProgress :percentage="props.node.cpu ?? 0" type="cpu" />
          </div>

          <div class="resource-item">
            <div class="flex items-center justify-between text-xs text-[#5c3a1e]">
              <div class="flex items-center gap-1">
                <img src="/images/icons/memory.svg" width="14" height="14" alt="Memory" class="opacity-80 shrink-0">
                <span>内存</span>
              </div>
              <b class="tabular-nums">{{ memPercentage.toFixed(1) }}%</b>
            </div>
            <PixelProgress :percentage="memPercentage" type="memory" />
          </div>

          <div class="resource-item">
            <div class="flex items-center justify-between text-xs text-[#5c3a1e]">
              <div class="flex items-center gap-1">
                <Icon icon="solar:disk-bold" width="14" height="14" class="opacity-70 shrink-0" />
                <span>硬盘</span>
              </div>
              <b class="tabular-nums">{{ diskPercentage.toFixed(1) }}%</b>
            </div>
            <PixelProgress :percentage="diskPercentage" type="disk" />
          </div>

          <div class="resource-item">
            <div class="flex items-center justify-between text-xs text-[#5c3a1e]">
              <div class="flex items-center gap-1">
                <Icon icon="solar:cloud-upload-bold" width="14" height="14" class="opacity-70 shrink-0" />
                <span>Load</span>
              </div>
              <b class="tabular-nums">{{ (props.node.load ?? 0).toFixed(2) }}</b>
            </div>
            <div class="text-[11px] text-[#5c3a1e]/80 truncate">
              {{ (props.node.load5 ?? 0).toFixed(2) }}, {{ (props.node.load15 ?? 0).toFixed(2) }} ({{ props.node.cpu_cores ?? 1 }}c)
            </div>
          </div>
        </div>

        <div class="traffic">
          <div>
            <div class="text-[11px] text-[#5c3a1e] flex items-center gap-1">
              <Icon icon="tabler:chevron-up" width="12" height="12" />
              <span>Upload</span>
            </div>
            <div class="text-xs font-medium tabular-nums">{{ formatBytesPerSecond(props.node.net_out ?? 0) }}</div>
          </div>
          <div>
            <div class="text-[11px] text-[#5c3a1e] flex items-center gap-1">
              <Icon icon="tabler:chevron-down" width="12" height="12" />
              <span>Download</span>
            </div>
            <div class="text-xs font-medium tabular-nums">{{ formatBytesPerSecond(props.node.net_in ?? 0) }}</div>
          </div>
        </div>

        <div class="flex gap-2">
          <div
            class="group/panel relative flex-1 flex flex-col gap-1 p-1.5 rounded-sm bg-[#5c3a1e]/[0.06]"
            :class="[!props.node.online ? 'blur-xs opacity-60' : '']"
            :title="latencyPanelTooltip"
          >
            <div class="flex items-center justify-between gap-2 text-[11px] leading-none text-[#5c3a1e]">
              <span>延迟</span>
              <span class="font-medium">{{ latencyDisplay }}</span>
            </div>
            <div class="ping-bar">
              <span
                v-for="i in 8"
                :key="i"
                class="ping-dot ping-dot--active"
              />
            </div>
          </div>
          <div
            class="group/panel relative flex-1 flex flex-col gap-1 p-1.5 rounded-sm bg-[#5c3a1e]/[0.06]"
            :class="[!props.node.online ? 'blur-xs opacity-60' : '']"
            :title="lossPanelTooltip"
          >
            <div class="flex items-center justify-between gap-2 text-[11px] leading-none text-[#5c3a1e]">
              <span>丢包</span>
              <span class="font-medium">{{ lossDisplay }}</span>
            </div>
            <div class="ping-bar">
              <span
                v-for="i in 8"
                :key="'loss-' + i"
                class="ping-dot ping-dot--active"
              />
            </div>
          </div>
        </div>

        <div v-if="priceTags.length" class="flex shrink-0 flex-row gap-2 items-center justify-center text-[11px] text-[#5c3a1e]" :class="[!props.node.online ? 'blur-xs opacity-60' : '']">
          <span v-for="(tag, idx) in priceTags" :key="idx">{{ tag }}</span>
        </div>
        <div v-if="appStore.showNodeUptime" class="flex flex-row gap-1 items-center justify-center text-[11px] text-[#5c3a1e]" :class="[!props.node.online ? 'blur-xs opacity-60' : '']">
          <Icon icon="tabler:clock-hour-4" width="12" height="12" />
          <span>{{ formatUptime(props.node.uptime ?? 0) }}</span>
        </div>
        <div v-if="customTags.length > 0" class="flex shrink-0 flex-wrap gap-1 items-center" :class="[!props.node.online ? 'blur-xs opacity-60' : '']">
          <Badge
            v-for="(tag, idx) in customTags"
            :key="idx"
            variant="outline"
            class="!text-[11px] rounded text-[#5c3a1e] border-[#5c3a1e]/20 px-1.5"
          >
            {{ tag }}
          </Badge>
        </div>
      </div>
    </template>
  </CardX>
</template>

<style scoped>
.node-card {
  position: relative;
  overflow: hidden;
}

.stardew-node-card {
  background: #f3e2bd url('/images/card/node-bg.png') !important;
  background-size: 100% 100% !important;
  border: 3px solid #5c3a1e !important;
  border-radius: 6px !important;
  box-shadow: 4px 4px 0 #3E2723 !important;
  image-rendering: auto;
  filter: drop-shadow(0 4px 0 #76502b);
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.stardew-node-card:hover {
  transform: translate(-1px, -1px);
  box-shadow: 5px 5px 0 #3E2723 !important;
}

.stardew-wood-card-offline {
  background: linear-gradient(180deg, #d4a5a5, #c08080) !important;
  border-color: #7f1d1d !important;
  border-radius: 6px !important;
  box-shadow: 4px 4px 0 #5c1a1a !important;
  filter: grayscale(0.35) brightness(0.92) drop-shadow(0 4px 0 #76502b);
}

.decor {
  position: absolute;
  width: 24px;
  height: 24px;
  image-rendering: pixelated;
  pointer-events: none;
  opacity: 0.85;
}
.decor-tl { top: 6px; left: 6px; }
.decor-tr { top: 6px; right: 6px; }
.decor-bl { bottom: 6px; left: 6px; }
.decor-br { bottom: 6px; right: 6px; }

.node-frame-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  pointer-events: none;
  z-index: 0;
  object-fit: fill;
}

.node-title-wrap {
  position: relative;
  padding-top: 10px;
}

.nail {
  position: absolute;
  top: 2px;
  right: 6px;
  width: 8px;
  height: 8px;
  image-rendering: pixelated;
  z-index: 2;
}

.resource-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.resource-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.traffic {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  background: rgba(255, 255, 255, 0.5);
  padding: 8px;
  border-radius: 6px;
}

.ping-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 10px;
}

.ping-dot {
  width: 8px;
  height: 8px;
  background: rgba(62, 39, 35, 0.15);
  border-radius: 2px;
}

.ping-dot--active {
  background: #67b447;
}
</style>
