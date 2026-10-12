<script setup lang="ts">
/**
 * HomeView —— 真实首页（M2-2a 卡片/总览 + M2-2b 工具栏/三态）
 *
 * 装配：顶部总览（OverviewBar）+ 搜索/排序/分组/状态筛选（NodeToolbar）+ 节点卡片网格。
 *  - 数据：@/v2/data/useClients 拉取 /api/rpc2（common:getNodes + getNodesLatestStatus），
 *    可在测试/部署中通过 CLIENTS_FETCHER_KEY 注入 mock 或自定义 fetcher。
 *  - 筛选/排序：全部复用 @/v2/data/nodeModel 纯函数（filterNodes / sortNodes / collectGroups），
 *    视图只持有用户输入，不自行实现第二套逻辑。
 *  - 三态（StatePlaceholder）：加载中 / 空（无节点）/ 错误（带重试，调 useClients().retry）。
 *  - 卡片网格：直接落在页面内容流里（容器 #vk-scene-mid），位于装饰场景层（z-index 0）之上，
 *    不再住进固定的场景槽位 —— 这样 ground/near 色带永远盖不住卡片，容器高度随内容自适应。
 */
import type { Node, SortDir, SortKey } from '@/v2/data/types'
import type { StatusFilter } from '@/v2/data/nodeModel'
import { computed, inject, ref } from 'vue'
import { CLIENTS_FETCHER_KEY, CLIENTS_INTERVAL_KEY } from '@/v2/data/injectionKeys'
import { collectGroups, assignAccents, filterNodes, sortNodes } from '@/v2/data/nodeModel'
import { useClients } from '@/v2/data/useClients'
import { buildOverviewStats } from '@/v2/data/overviewStats'
import type { Fetcher } from '@/v2/data/client'
import NodeCard from '@/v2/components/NodeCard.vue'
import OverviewBar from '@/v2/components/OverviewBar.vue'
import NodeToolbar from '@/v2/components/NodeToolbar.vue'
import StatePlaceholder from '@/v2/components/StatePlaceholder.vue'

defineOptions({ name: 'HomeView' })

const fetcher = inject<Fetcher | undefined>(CLIENTS_FETCHER_KEY, undefined)
const intervalMs = inject<number | undefined>(CLIENTS_INTERVAL_KEY, undefined)

const { nodes, loading, refreshing, error, retry } = useClients({
  fetcher,
  intervalMs: intervalMs ?? 5000,
})

/* ---- 用户输入（唯一视图态；计算全交纯函数） ---- */
const query = ref('')
const sortKey = ref<SortKey>('default')
const sortDir = ref<SortDir>('asc')
const group = ref('')
const status = ref<StatusFilter>('all')

const groups = computed(() => collectGroups(nodes.value))

/** 过滤 + 排序后的可见节点 */
const visibleNodes = computed<Node[]>(() => sortNodes(
  filterNodes(nodes.value, {
    query: query.value,
    group: group.value,
    status: status.value,
  }),
  sortKey.value,
  sortDir.value,
))

const stats = computed(() => buildOverviewStats(nodes.value))
const firstLoad = computed(() => nodes.value.length === 0 && (loading.value || refreshing.value))

/** 主题色槽按「全量节点」分配（不随筛选/排序变化）→ 同一台每次同色，且 ≤6 台时互不同色 */
const accentSlots = computed(() => assignAccents(nodes.value.map(n => n.uuid)))

/** 空节点时的整页状态：error 优先 → loading → empty；有节点则不占位 */
const pageState = computed<'loading' | 'empty' | 'error' | null>(() => {
  if (nodes.value.length > 0)
    return null
  if (error.value)
    return 'error'
  if (firstLoad.value)
    return 'loading'
  return 'empty'
})

/** 有节点但被筛选过滤完 → 网格区空态 */
const noMatch = computed(() => nodes.value.length > 0 && visibleNodes.value.length === 0)
</script>

<template>
  <section class="vk-home">
    <h1 class="vk-title">
      节点总览
    </h1>

    <OverviewBar :nodes="nodes" />

    <NodeToolbar
      v-model:query="query"
      v-model:sort-key="sortKey"
      v-model:sort-dir="sortDir"
      v-model:group="group"
      v-model:status="status"
      :groups="groups"
      :visible-count="visibleNodes.length"
      :total-count="nodes.length"
    />

    <StatePlaceholder
      v-if="pageState"
      :state="pageState"
      :detail="pageState === 'error' ? error ?? undefined : undefined"
      @retry="retry"
    />

    <p v-else class="vk-home-hint" data-testid="home-summary">
      共 {{ stats.total }} 台、在线 {{ stats.online }}、告警 {{ stats.alert }}、未知 {{ stats.unknown }}。
    </p>

    <StatePlaceholder
      v-if="!pageState && noMatch"
      state="empty"
      message="没有匹配的节点"
      detail="试试清空搜索或切换筛选条件"
    />

    <!-- 卡片网格：正常内容流中（在装饰场景之上），id 保持 #vk-scene-mid 供 e2e/探针选择 -->
    <div v-if="!noMatch" id="vk-scene-mid" class="vk-node-grid" data-scene-slot="mid">
      <NodeCard
        v-for="n in visibleNodes"
        :key="n.uuid"
        :node="n"
        :accent-index="accentSlots.get(n.uuid)"
      />
    </div>
  </section>
</template>
