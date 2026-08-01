<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useNodePingDisplay } from '@/composables/useNodePingDisplay'
import { useAppStore } from '@/stores/app'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig } from '@/utils/helper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { getDaysUntilExpired, getExpireStatus } from '@/utils/tagHelper'
import PixelProgress from '@/components/PixelProgress.vue'
import { cn } from '@/lib/utils'

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

type BannerTheme = {
  key: string
  banner: string
  accent: string
  barCpu: string
  barMem: string
  barDisk: string
  barLoad: string
  decor: string
}

const themes: readonly BannerTheme[] = [
  {
    key: 'green',
    banner: '#4caf50',
    accent: '#2e7d32',
    barCpu: '#66bb6a',
    barMem: '#81c784',
    barDisk: '#a5d6a7',
    barLoad: '#ffb74d',
    decor: 'mdi:sprout',
  },
  {
    key: 'blue',
    banner: '#42a5f5',
    accent: '#1565c0',
    barCpu: '#42a5f5',
    barMem: '#64b5f6',
    barDisk: '#90caf9',
    barLoad: '#ffb74d',
    decor: 'mdi:home-variant',
  },
  {
    key: 'purple',
    banner: '#7e57c2',
    accent: '#4527a0',
    barCpu: '#ab47bc',
    barMem: '#ba68c8',
    barDisk: '#ce93d8',
    barLoad: '#ffb74d',
    decor: 'mdi:flower',
  },
  {
    key: 'pink',
    banner: '#ec407a',
    accent: '#ad1457',
    barCpu: '#ec407a',
    barMem: '#f06292',
    barDisk: '#f48fb1',
    barLoad: '#ffb74d',
    decor: 'mdi:tree',
  },
  {
    key: 'orange',
    banner: '#ff9800',
    accent: '#e65100',
    barCpu: '#ffa726',
    barMem: '#66bb6a',
    barDisk: '#ffb74d',
    barLoad: '#ffb74d',
    decor: 'mdi:account-cowboy-hat',
  },
  {
    key: 'teal',
    banner: '#26a69a',
    accent: '#00695c',
    barCpu: '#26a69a',
    barMem: '#4db6ac',
    barDisk: '#80cbc4',
    barLoad: '#ffb74d',
    decor: 'mdi:bird',
  },
]

const theme = computed<BannerTheme>(() => {
  const name = props.node.name || ''
  let hash = 0
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return themes[hash % themes.length]!
})

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
    <!-- corner plant / character -->
    <div class="sd-plant" :style="{ color: theme.accent }">
      <Icon :icon="theme.decor" width="28" height="28" />
    </div>

    <!-- online status dot -->
    <span class="sd-status" :class="offline ? 'sd-status--off' : 'sd-status--on'" />

    <!-- title banner -->
    <div class="sd-banner" :style="{ background: theme.banner }">
      <span class="sd-banner__name">{{ props.node.name }}</span>
      <img
        v-if="hasRegion(props.node.region)"
        :src="`/images/flags/${getRegionCode(props.node.region)}.svg`"
        :alt="getRegionDisplayName(props.node.region)"
        class="sd-banner__flag"
      >
    </div>

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
            <Icon icon="mdi:chip" width="14" height="14" />
            CPU
          </span>
          <b class="sd-metric__val" :style="{ color: theme.barCpu }">{{ (props.node.cpu ?? 0).toFixed(0) }}%</b>
        </div>
        <PixelProgress :percentage="props.node.cpu ?? 0" :color="theme.barCpu" />
      </div>

      <div class="sd-metric">
        <div class="sd-metric__head">
          <span class="sd-metric__label">
            <Icon icon="mdi:memory" width="14" height="14" />
            Memory
          </span>
          <b class="sd-metric__val" :style="{ color: theme.barMem }">{{ memPercentage.toFixed(1) }}%</b>
        </div>
        <PixelProgress :percentage="memPercentage" :color="theme.barMem" />
      </div>

      <div class="sd-metric">
        <div class="sd-metric__head">
          <span class="sd-metric__label">
            <Icon icon="mdi:harddisk" width="14" height="14" />
            Disk
          </span>
          <b class="sd-metric__val" :style="{ color: theme.barDisk }">{{ diskPercentage.toFixed(1) }}%</b>
        </div>
        <PixelProgress :percentage="diskPercentage" :color="theme.barDisk" />
      </div>

      <div class="sd-metric">
        <div class="sd-metric__head">
          <span class="sd-metric__label">
            <Icon icon="mdi:chart-bar" width="14" height="14" />
            Load
          </span>
          <b class="sd-metric__val" :style="{ color: theme.barLoad }">{{ (props.node.load ?? 0).toFixed(2) }}</b>
        </div>
        <PixelProgress :percentage="loadPct" :color="theme.barLoad" />
      </div>
    </div>

    <!-- upload / download -->
    <div class="sd-row sd-row--speed">
      <div class="sd-pair">
        <span class="sd-pair__label">
          <Icon icon="mdi:arrow-up-bold" width="12" height="12" class="c-sky" />
          Upload
        </span>
        <span class="sd-pair__val c-sky">{{ formatBytesPerSecond(props.node.net_out ?? 0) }}</span>
      </div>
      <div class="sd-pair">
        <span class="sd-pair__label">
          <Icon icon="mdi:arrow-down-bold" width="12" height="12" class="c-em" />
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
            :key="'lat-' + i"
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
            :key="'loss-' + i"
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
  border: 3px solid #6b4423;
  border-radius: 12px;
  box-shadow:
    4px 4px 0 #3e2723,
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
  color: #3a2a1a;
  font-family: 'VT323', 'Press Start 2P', 'Nunito', system-ui, sans-serif;
  letter-spacing: 0.02em;
  transition: transform 120ms ease, box-shadow 120ms ease;
  overflow: visible;
  image-rendering: auto;
}

.sd-card:hover {
  transform: translate(-1px, -1px);
  box-shadow:
    6px 6px 0 #3e2723,
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

.sd-card--offline {
  filter: grayscale(0.35) brightness(0.95);
  border-color: #7a3b2a;
  box-shadow: 4px 4px 0 #5a2417;
}

.sd-plant {
  position: absolute;
  top: -10px;
  left: -8px;
  z-index: 3;
  filter: drop-shadow(1px 2px 0 rgba(62, 39, 35, 0.25));
  pointer-events: none;
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

.sd-banner {
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 56%;
  max-width: 88%;
  padding: 4px 14px;
  margin-top: 2px;
  border-radius: 8px;
  border: 2px solid rgba(62, 39, 35, 0.35);
  box-shadow:
    0 2px 0 rgba(62, 39, 35, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  color: #fff;
  z-index: 2;
}

.sd-banner__name {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
  letter-spacing: 0.04em;
}

.sd-banner__flag {
  height: 12px;
  width: auto;
  max-width: 18px;
  object-fit: contain;
  border-radius: 1px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
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
  background: #67b447;
  border-color: #4a8c2e;
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

.c-sky { color: #0288d1; }
.c-em { color: #2e7d32; }
.c-rose { color: #c62828; }
</style>
