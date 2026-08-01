<script setup lang="ts">
import { computed } from 'vue'
import { useNodesStore } from '@/stores/nodes'

const nodesStore = useNodesStore()

const totalDiskUsed = computed(() => nodesStore.nodes.reduce((s, n) => s + (n.disk || 0), 0))
const totalDiskTotal = computed(() => nodesStore.nodes.reduce((s, n) => s + (n.disk_total || 0), 0))
const totalTraffic = computed(() => nodesStore.nodes.reduce((s, n) => s + (n.net_total_up || 0) + (n.net_total_down || 0), 0))
const totalNetOut = computed(() => nodesStore.nodes.reduce((s, n) => s + (n.net_out || 0), 0))
const totalNetIn = computed(() => nodesStore.nodes.reduce((s, n) => s + (n.net_in || 0), 0))

const formatBytes = (bytes: number) => {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
}
</script>

<template>
  <div class="stardew-stats-bar">
    <div class="stat-item">
      <div class="stat-label">硬盘用量</div>
      <div class="stat-value">{{ formatBytes(totalDiskUsed) }} / {{ formatBytes(totalDiskTotal) }}</div>
      <img src="/images/icons/disk.svg" class="stat-icon" alt="disk" />
    </div>
    <div class="stat-item">
      <div class="stat-label">累计流量</div>
      <div class="stat-value">{{ formatBytes(totalTraffic) }}</div>
      <img src="/images/icons/traffic.svg" class="stat-icon" alt="traffic" />
    </div>
    <div class="stat-item">
      <div class="stat-label">实时下行</div>
      <div class="stat-value">{{ formatBytes(totalNetIn) }}/s</div>
      <img src="/images/icons/download.svg" class="stat-icon" alt="download" />
    </div>
  </div>
</template>

<style scoped>
.stardew-stats-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 12px 16px;
  background: rgba(243, 226, 189, 0.95);
  border: 3px solid #5c3a1e;
  border-radius: 8px;
  box-shadow: 3px 3px 0 #3E2723;
  image-rendering: auto;
}

.stat-item {
  position: relative;
  padding: 10px 12px;
  background: #fff8e7;
  border: 2px solid #5c3a1e;
  border-radius: 6px;
  min-height: 64px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.stat-label {
  font-size: 11px;
  color: #5c3a1e;
  font-weight: bold;
}

.stat-value {
  font-size: 13px;
  color: #3E2723;
  font-weight: bold;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.stat-icon {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  image-rendering: pixelated;
  opacity: 0.85;
}
</style>
