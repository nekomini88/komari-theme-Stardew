<script setup lang="ts">
/**
 * HomeView —— 真实首页（M2-2a）
 *
 * 装配：顶部总览（OverviewBar）+ 节点卡片网格（NodeCard）。
 *  - 数据：@/v2/data/useClients 拉取 /api/rpc2（common:getNodes + getNodesLatestStatus），
 *    可在测试/部署中通过 CLIENTS_FETCHER_KEY 注入 mock 或自定义 fetcher。
 *  - 卡片「住进场景」：通过 Teleport 送入 SceneStack 的 mid 层槽位 #vk-scene-mid
 *    （mid 视差 0.5，容器底部对齐 ground 基线），不浮在空中。
 *  - 接口 /instance/:id 仍为占位，未在本阶段改动。
 */
import type { Node } from '@/v2/data/types'
import { computed, inject } from 'vue'
import { CLIENTS_FETCHER_KEY, CLIENTS_INTERVAL_KEY } from '@/v2/data/injectionKeys'
import { sortNodes } from '@/v2/data/nodeModel'
import { useClients } from '@/v2/data/useClients'
import { buildOverviewStats } from '@/v2/data/overviewStats'
import type { Fetcher } from '@/v2/data/client'
import NodeCard from '@/v2/components/NodeCard.vue'
import OverviewBar from '@/v2/components/OverviewBar.vue'

defineOptions({ name: 'HomeView' })

const fetcher = inject<Fetcher | undefined>(CLIENTS_FETCHER_KEY, undefined)
const intervalMs = inject<number | undefined>(CLIENTS_INTERVAL_KEY, undefined)

const { nodes, loading, refreshing, error } = useClients({
  fetcher,
  intervalMs: intervalMs ?? 5000,
})

const sortedNodes = computed<Node[]>(() => sortNodes(nodes.value, 'default'))
const stats = computed(() => buildOverviewStats(nodes.value))
const firstLoad = computed(() => nodes.value.length === 0 && (loading.value || refreshing.value))
</script>

<template>
  <section class="vk-home">
    <h1 class="vk-title">
      节点总览
    </h1>

    <OverviewBar :nodes="nodes" />

    <p v-if="error" class="vk-home-hint" data-testid="home-error">
      数据刷新失败：{{ error }}
    </p>
    <p v-else-if="firstLoad" class="vk-home-hint" data-testid="home-loading">
      载入中…
    </p>
    <p v-else class="vk-home-hint" data-testid="home-summary">
      共 {{ stats.total }} 台，在线 {{ stats.online }} 台，告警口径见卡片状态。
    </p>

    <!-- 卡片住进 SceneStack mid 层（#vk-scene-mid 由 App.vue 在场景中提供） -->
    <Teleport to="#vk-scene-mid">
      <NodeCard
        v-for="n in sortedNodes"
        :key="n.uuid"
        :node="n"
      />
    </Teleport>
  </section>
</template>
