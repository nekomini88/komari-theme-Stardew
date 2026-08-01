<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { ProgressThin } from '@/components/ui/progress-thin'
import type { NodeData } from '@/stores/nodes'
import { useAppStore } from '@/stores/app'
import { formatBytesWithConfig } from '@/utils/helper'

const props = withDefaults(defineProps<{
  node: NodeData
  type: 'cpu' | 'memory' | 'disk' | 'traffic'
  icon: string
}>(), {})

const appStore = useAppStore()
const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, appStore.byteDecimals)
const n = computed(() => props.node)

const percent = computed(() => {
  const node = n.value
  switch (props.type) {
    case 'cpu':
      return node.cpu ?? 0
    case 'memory':
      return ((node.ram ?? 0) / (node.mem_total || 1)) * 100
    case 'disk':
      return ((node.disk ?? 0) / (node.disk_total || 1)) * 100
    case 'traffic': {
      const { net_total_up = 0, net_total_down = 0, traffic_limit = 0, traffic_limit_type } = node
      if (traffic_limit <= 0) return 0
      let used = 0
      switch (traffic_limit_type) {
        case 'up': used = net_total_up; break
        case 'down': used = net_total_down; break
        case 'min': used = Math.min(net_total_up, net_total_down); break
        case 'max': used = Math.max(net_total_up, net_total_down); break
        default: used = net_total_up + net_total_down; break
      }
      return Math.min((used / traffic_limit) * 100, 100)
    }
  }
})

const detailText = computed(() => {
  const node = n.value
  switch (props.type) {
    case 'cpu':
      return `${node.load.toFixed(2)}, ${node.load5.toFixed(2)}, ${node.load15.toFixed(2)} (${node.cpu_cores}c)`
    case 'memory':
      return `${formatBytes(node.ram ?? 0)} / ${formatBytes(node.mem_total ?? 0)}`
    case 'disk':
      return `${formatBytes(node.disk ?? 0)} / ${formatBytes(node.disk_total ?? 0)}`
    case 'traffic': {
      const { net_total_up = 0, net_total_down = 0, traffic_limit = 0, traffic_limit_type } = node
      const limit = traffic_limit > 0 ? formatBytes(traffic_limit) : '∞'
      if (traffic_limit_type === 'sum' || traffic_limit <= 0) {
        return `${formatBytes(net_total_up + net_total_down)} / ${limit}`
      }
      return `${formatBytes(net_total_up + net_total_down)} / ${limit}`
    }
  }
})

const label = computed(() => {
  switch (props.type) {
    case 'cpu': return 'CPU'
    case 'memory': return '内存'
    case 'disk': return '硬盘'
    case 'traffic': return '流量'
  }
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between text-xs">
      <div class="flex items-center gap-1.5">
        <Icon :icon="icon" width="14" height="14" class="opacity-70" />
        <span class="text-muted-foreground">{{ label }}</span>
      </div>
      <span class="font-medium tabular-nums">{{ percent.toFixed(1) }}%</span>
    </div>
    <ProgressThin :percentage="percent" :height="4" />
    <div class="text-[11px] text-muted-foreground truncate">{{ detailText }}</div>
  </div>
</template>
