<script setup lang="ts">
import ResourceBar from './ResourceBar.vue'
import StatusBadge from './StatusBadge.vue'
import type { NodeData } from '@/stores/nodes'
defineProps<{node: NodeData}>()
</script>
<template>
<div class="farm-node">
  <div class="farm-node__icon">🏡</div>
  <div class="farm-node__name">{{ node.name }}</div>
  <StatusBadge :online="!!node.online" />
  <ResourceBar icon="⚙" label="CPU" :value="Number(node.cpu ?? 0)" />
  <ResourceBar icon="🌱" label="RAM" :value="Number(node.ram ?? 0)" />
  <ResourceBar icon="💎" label="DISK" :value="Number(node.disk ?? 0)" />
</div>
</template>
