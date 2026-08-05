
<script setup lang="ts">
import { computed } from 'vue'
import { useNodesStore } from '@/stores/nodes'
import BuildingCard from './BuildingCard.vue'
const store = useNodesStore()
const nodes = computed(() => store.nodes || [])
</script>
<template>
<div class="farm-map">
  <div v-for="(node,i) in nodes" :key="node.uuid || i" class="farm-building"
       :style="{left:(15+(i%4)*22)+'%',top:(20+Math.floor(i/4)*35)+'%'}">
    <BuildingCard :node="node"/>
  </div>
</div>
</template>
<style scoped>
.farm-map{position:relative;min-height:650px;border:8px solid #5b3416;border-radius:20px;background:#79b45a;background-image:radial-gradient(#8bc76a 2px,transparent 2px);background-size:28px 28px;overflow:hidden}
.farm-building{position:absolute;transform:translate(-50%,-50%)}
</style>
