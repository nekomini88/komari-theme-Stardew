<script setup lang="ts">
/**
 * 实例详情占位（M1 骨架）。
 * 路由 /instance/:id 与数据钩子保留：按 route.params.id 从 useNodesStore 查节点。
 * 真实历史曲线 / Ping 图 / 基础信息 / 操作区在 M3 实现。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useNodesStore } from '@/stores/nodes'

const route = useRoute()
const nodesStore = useNodesStore()
const node = computed(() => nodesStore.nodes.find(n => n.uuid === route.params.id))
</script>

<template>
  <section class="vk-placeholder">
    <h1 class="vk-title">实例详情（M1 占位）</h1>
    <div class="vk-panel">
      <p class="vk-muted">
        路由参数 id：<span class="vk-tag">{{ String(route.params.id) }}</span>
      </p>
      <p v-if="node" class="vk-muted">
        命中实例：<strong>{{ node.name }}</strong>（{{ node.region }}）
      </p>
      <p v-else class="vk-muted">
        未在 <span class="vk-tag">/api/clients</span> 数据中找到该实例（占位兜底，M3 补异常态）。
      </p>
      <p class="vk-muted">M3 将在此渲染历史曲线、Ping 图与操作区。</p>
    </div>
  </section>
</template>
