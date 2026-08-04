<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import * as financeHelper from '@/utils/financeHelper'
import { formatBytesPerSecondSplit, formatBytesSplit } from '@/utils/helper'

const nodesStore = useNodesStore()
const appStore = useAppStore()

const nodes = computed(() => nodesStore.nodes)

const totalMemoryUsed = computed(() => nodes.value.reduce((s, n) => s + (n.ram || 0), 0))
const totalMemoryTotal = computed(() => nodes.value.reduce((s, n) => s + (n.mem_total || 0), 0))
const totalDiskUsed = computed(() => nodes.value.reduce((s, n) => s + (n.disk || 0), 0))
const totalDiskTotal = computed(() => nodes.value.reduce((s, n) => s + (n.disk_total || 0), 0))
const totalTraffic = computed(() => {
  const up = nodes.value.reduce((s, n) => s + (n.net_total_up || 0), 0)
  const down = nodes.value.reduce((s, n) => s + (n.net_total_down || 0), 0)
  return up + down
})
const totalSpeedUp = computed(() => nodes.value.reduce((s, n) => s + (n.net_out || 0), 0))
const totalSpeedDown = computed(() => nodes.value.reduce((s, n) => s + (n.net_in || 0), 0))

const memPct = computed(() => {
  const t = totalMemoryTotal.value || 1
  return ((totalMemoryUsed.value / t) * 100).toFixed(1)
})
const diskPct = computed(() => {
  const t = totalDiskTotal.value || 1
  return ((totalDiskUsed.value / t) * 100).toFixed(1)
})

const balanceText = computed(() => {
  try {
    const value = financeHelper.calculateTotalRemainingValueCNY(nodes.value, financeHelper.DEFAULT_EXCHANGE_RATES)
    const currency = appStore.lang === 'zh-CN' ? 'CNY' : 'USD'
    const formatted = financeHelper.formatFinanceAmount(value, currency)
    return `${formatted.symbol}${formatted.value} ${formatted.currency}`
  }
  catch {
    return '¥0 CNY'
  }
})

const fmt = (bytes: number) => formatBytesSplit(bytes)
const fmtSpeed = (bytes: number) => formatBytesPerSecondSplit(bytes)
</script>

<template>
  <div class="stardew-stats-grid">
    <div class="stardew-wood-card stardew-stat">
      <img src="/images/icons/memory.png" class="stardew-stat__icon" alt="">
      <div class="stardew-stat__body">
        <div class="stardew-stat__label">
          内存
        </div>
        <div class="stardew-stat__value good">
          {{ memPct }}%
        </div>
        <div class="stardew-stat__sub">
          {{ fmt(totalMemoryUsed).value }} {{ fmt(totalMemoryUsed).unit }} / {{ fmt(totalMemoryTotal).value }} {{ fmt(totalMemoryTotal).unit }}
        </div>
      </div>
    </div>

    <div class="stardew-wood-card stardew-stat">
      <img src="/images/icons/disk.png" class="stardew-stat__icon" alt="">
      <div class="stardew-stat__body">
        <div class="stardew-stat__label">
          硬盘
        </div>
        <div class="stardew-stat__value good">
          {{ diskPct }}%
        </div>
        <div class="stardew-stat__sub">
          {{ fmt(totalDiskUsed).value }} {{ fmt(totalDiskUsed).unit }} / {{ fmt(totalDiskTotal).value }} {{ fmt(totalDiskTotal).unit }}
        </div>
      </div>
    </div>

    <div class="stardew-wood-card stardew-stat">
      <Icon icon="tabler:coin" :width="28" :height="28" class="stardew-stat__icon-lucide" />
      <div class="stardew-stat__body">
        <div class="stardew-stat__label">
          剩余价值
        </div>
        <div class="stardew-stat__value">
          {{ balanceText }}
        </div>
      </div>
    </div>

    <div class="stardew-wood-card stardew-stat">
      <img src="/images/icons/traffic.png" class="stardew-stat__icon" alt="">
      <div class="stardew-stat__body">
        <div class="stardew-stat__label">
          累计流量
        </div>
        <div class="stardew-stat__value">
          {{ fmt(totalTraffic).value }} {{ fmt(totalTraffic).unit }}
        </div>
      </div>
    </div>

    <div class="stardew-wood-card stardew-stat">
      <img src="/images/icons/traffic.png" class="stardew-stat__icon" alt="">
      <div class="stardew-stat__body">
        <div class="stardew-stat__label">
          实时上行
        </div>
        <div class="stardew-stat__value">
          {{ fmtSpeed(totalSpeedUp).value }}{{ fmtSpeed(totalSpeedUp).unit }}/s
        </div>
      </div>
    </div>

    <div class="stardew-wood-card stardew-stat">
      <img src="/images/icons/download.png" class="stardew-stat__icon" alt="">
      <div class="stardew-stat__body">
        <div class="stardew-stat__label">
          实时下行
        </div>
        <div class="stardew-stat__value">
          {{ fmtSpeed(totalSpeedDown).value }}{{ fmtSpeed(totalSpeedDown).unit }}/s
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stardew-stats-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 12px;
  padding: 12px 16px 4px;
}
@media (min-width: 640px) {
  .stardew-stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1024px) {
  .stardew-stats-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.stardew-stat {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  min-height: 88px;
  background: #f6e7c4 !important;
  border: 4px solid #6b4423 !important;
  border-radius: 10px !important;
  box-shadow: 5px 5px 0 #3e2723 !important;
  image-rendering: pixelated;
}

.stardew-stat__icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  image-rendering: pixelated;
  object-fit: contain;
}
.stardew-stat__icon-lucide {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  color: #6b4423;
}

.stardew-stat__body {
  min-width: 0;
  flex: 1;
}
.stardew-stat__label {
  font-size: 12px;
  font-weight: 700;
  color: #5c3a1e;
  letter-spacing: 0.04em;
  margin-bottom: 2px;
}
.stardew-stat__value {
  font-size: 20px;
  font-weight: 800;
  color: #3e2723;
  font-family: 'VT323', 'Press Start 2P', ui-monospace, monospace;
  line-height: 1.15;
}
.stardew-stat__value.good {
  color: #2e7d32;
}
.stardew-stat__sub {
  font-size: 11px;
  color: #7a5a32;
  margin-top: 2px;
  font-family: 'VT323', monospace;
}
</style>
