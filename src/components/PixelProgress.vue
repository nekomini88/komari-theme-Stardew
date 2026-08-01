<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  percentage: number
  type?: 'cpu' | 'memory' | 'disk' | 'traffic'
  size?: number
}>(), {
  type: 'cpu',
  size: 10,
})

const blocks = 10
const filledCount = computed(() => Math.min(Math.max(Math.round(props.percentage / 10), 0), blocks))

const activeColor = computed(() => {
  switch (props.type) {
    case 'cpu': return '#9c27b0'
    case 'memory': return '#4caf50'
    case 'disk': return '#9e9e9e'
    case 'traffic': return '#2196f3'
  }
})
</script>

<template>
  <div class="pixel-progress" :style="{ gap: `${Math.max(1, Math.floor(size / 5))}px` }">
    <span
      v-for="i in blocks"
      :key="i"
      class="pixel-block"
      :class="{ 'pixel-block--active': i <= filledCount }"
      :style="{
        width: `${size}px`,
        height: `${Math.max(4, size - 2)}px`,
        background: i <= filledCount ? activeColor : 'rgba(62,39,35,0.12)',
      }"
    />
  </div>
</template>

<style scoped>
.pixel-progress {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 2px;
  image-rendering: pixelated;
  height: 10px;
}

.pixel-block {
  display: inline-block;
  height: 100%;
  border-radius: 1px;
  transition: background 150ms ease;
  border: 1px solid #5c3a1e;
}

.pixel-block--active {
  background: repeating-linear-gradient(90deg, #4a9c2a 0 3px, #5cb838 3px 5px);
}
</style>
