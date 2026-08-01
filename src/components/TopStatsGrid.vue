<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useNodesStore } from '@/stores/nodes'
import { useAppStore } from '@/stores/app'
import * as financeHelper from '@/utils/financeHelper'
import { formatBytesSplit, formatBytesPerSecondSplit } from '@/utils/helper'

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

const balanceText = computed(() => {
  try {
    const value = financeHelper.calculateTotalRemainingValueCNY(nodes.value, financeHelper.DEFAULT_EXCHANGE_RATES)
    const currency = appStore.lang === 'zh-CN' ? 'CNY' : 'USD'
    const formatted = financeHelper.formatFinanceAmount(value, currency)
    return `${formatted.symbol}${formatted.value} ${formatted.currency}`
  } catch {
    return '¥0 CNY'
  }
})

const fmt = (bytes: number) => formatBytesSplit(bytes)
const fmtSpeed = (bytes: number) => formatBytesPerSecondSplit(bytes)
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
    <div class="stardew-stat">
      <div class="stardew-stat__label">
        <Icon icon="tabler:device-memory" :width="14" :height="14" />
        <span>内存用量</span>
      </div>
      <div class="stardew-stat__value">{{ fmt(totalMemoryUsed).value }} {{ fmt(totalMemoryUsed).unit }} / {{ fmt(totalMemoryTotal).value }} {{ fmt(totalMemoryTotal).unit }}</div>
      <img src="/images/icons/memory.svg" class="stardew-stat__icon" alt="memory" />
    </div>

    <div class="stardew-stat">
      <div class="stardew-stat__label">
        <Icon icon="tabler:coin" :width="14" :height="14" />
        <span>剩余价值</span>
      </div>
      <div class="stardew-stat__value">{{ balanceText }}</div>
      <img src="/images/icons/traffic.svg" class="stardew-stat__icon" alt="balance" />
    </div>

    <div class="stardew-stat">
      <div class="stardew-stat__label">
        <Icon icon="tabler:arrow-up" :width="14" :height="14" />
        <span>实时上行</span>
      </div>
      <div class="stardew-stat__value">{{ fmtSpeed(totalSpeedUp).value }}{{ fmtSpeed(totalSpeedUp).unit }}/s</div>
      <img src="/images/icons/traffic.svg" class="stardew-stat__icon" alt="up" />
    </div>

    <div class="stardew-stat">
      <div class="stardew-stat__label">
        <Icon icon="tabler:database" :width="14" :height="14" />
        <span>硬盘用量</span>
      </div>
      <div class="stardew-stat__value">{{ fmt(totalDiskUsed).value }} {{ fmt(totalDiskUsed).unit }} / {{ fmt(totalDiskTotal).value }} {{ fmt(totalDiskTotal).unit }}</div>
      <img src="/images/icons/disk.svg" class="stardew-stat__icon" alt="disk" />
    </div>

    <div class="stardew-stat">
      <div class="stardew-stat__label">
        <Icon icon="tabler:chart-bar" :width="14" :height="14" />
        <span>累计流量</span>
      </div>
      <div class="stardew-stat__value">{{ fmt(totalTraffic).value }} {{ fmt(totalTraffic).unit }}</div>
      <img src="/images/icons/traffic.svg" class="stardew-stat__icon" alt="traffic" />
    </div>

    <div class="stardew-stat">
      <div class="stardew-stat__label">
        <Icon icon="tabler:arrow-down" :width="14" :height="14" />
        <span>实时下行</span>
      </div>
      <div class="stardew-stat__value">{{ fmtSpeed(totalSpeedDown).value }}{{ fmtSpeed(totalSpeedDown).unit }}/s</div>
      <img src="/images/icons/download.svg" class="stardew-stat__icon" alt="down" />
    </div>
  </div>
</template>

<style scoped>
.stardew-stat {
  position: relative;
  padding: 12px 14px;
  background: #fff8e7;
  border: 3px solid #5c3a1e;
  border-radius: 8px;
  box-shadow: 4px 4px 0 #3E2723;
  min-height: 72px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  image-rendering: auto;
}

.stardew-stat__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #5c3a1e;
  font-weight: bold;
}

.stardew-stat__value {
  font-size: 14px;
  color: #3E2723;
  font-weight: bold;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.stardew-stat__icon {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  image-rendering: pixelated;
  opacity: 0.85;
}
</style>
