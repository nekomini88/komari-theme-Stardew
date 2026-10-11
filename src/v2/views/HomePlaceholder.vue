<script setup lang="ts">
/**
 * 首页占位（M1 骨架）。
 * 路由 / 与数据钩子保留：节点数据由 useNodesStore（/api/clients 驱动）提供。
 * 真实节点卡片 / 实时指标 / 延迟图在 M2 实现；卡片将“住”在场景 mid 层。
 */
import { computed } from 'vue'
import { useNodesStore } from '@/stores/nodes'

const nodesStore = useNodesStore()
const nodeCount = computed(() => nodesStore.nodes.length)
</script>

<template>
  <section class="vk-placeholder">
    <h1 class="vk-title">节点总览（M1 占位）</h1>
    <div class="vk-panel">
      <p class="vk-muted">
        数据钩子已保留：节点经 <span class="vk-tag">/api/clients</span> 由 useNodesStore 驱动，当前节点数
        <strong>{{ nodeCount }}</strong>。
      </p>
      <p class="vk-muted">
        实时状态经 <span class="vk-tag">/api/rpc2</span> 推送（initApp 已接线）。
      </p>
      <p class="vk-muted">M2 将在此渲染节点卡片、实时指标、延迟图，卡片与场景同系统。</p>
    </div>
  </section>
</template>
