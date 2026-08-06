<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  percentage: number
  type?: 'cpu' | 'memory' | 'disk' | 'traffic' | 'load'
  color?: string
  size?: number
  blocks?: number
}>(), {
  type: 'cpu',
  size: 9,
  blocks: 10,
})

const filledCount = computed(() => {
  const n = props.blocks
  return Math.min(Math.max(Math.round(props.percentage / (100 / n)), 0), n)
})

const activeColor = computed(() => {
  if (props.color)
    return props.color
  switch (props.type) {
    case 'cpu': return '#66bb6a'
    case 'memory': return '#42a5f5'
    case 'disk': return '#ab47bc'
    case 'traffic': return '#26a69a'
    case 'load': return '#ffb74d'
    default: return '#66bb6a'
  }
})

function blockStyle(i: number) {
  const filled = i <= filledCount.value
  return {
    width: `${props.size}px`,
    height: `${Math.max(7, props.size)}px`,
    // 空槽: 官方凹槽素材; 已填充: 纯色块
    background: filled
      ? activeColor.value
      : `url('/images/card/progress-slot.png') center / 100% 100% no-repeat`,
    boxShadow: filled
      ? 'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.18)'
      : 'none',
  }
}
</script>

<template>
  <div class="pixel-progress">
    <span
      v-for="i in blocks"
      :key="i"
      class="pixel-block"
      :class="{ 'pixel-block--active': i <= filledCount }"
      :style="blockStyle(i)"
    />
  </div>
</template>

<style scoped>
.pixel-progress {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 2px;
  height: 12px;
  image-rendering: pixelated;
}

.pixel-block {
  display: inline-block;
  border-radius: 1px;
  transition: background 120ms ease;
}

.pixel-block--active {
  border: 1px solid rgba(62, 39, 35, 0.3);
}
</style>