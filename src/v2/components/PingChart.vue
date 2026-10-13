<script setup lang="ts">
/**
 * PingChart —— 延迟曲线（延迟值 <0 视为丢包 → 断点缺口）
 *
 * 数据变换走 @/v2/data/history.buildPingSeries（task_id 过滤 + 断点清洗），
 * 再交给 HistoryChart 渲染，不在本组件重写任何计算。
 */
import { computed } from 'vue'
import { buildPingSeries } from '@/v2/data/history'
import HistoryChart from '@/v2/components/HistoryChart.vue'

const props = withDefaults(defineProps<{
  records: readonly Record<string, unknown>[] | null | undefined
  taskId?: number
  title?: string
  width?: number
  height?: number
}>(), {
  taskId: undefined,
  title: '延迟',
  width: 220,
  height: 64,
})

const series = computed(() => buildPingSeries(props.records, props.taskId))
</script>

<template>
  <div class="vk-ping-chart" data-testid="ping-chart">
    <HistoryChart
      :series="series"
      :title="title"
      unit="ms"
      series-kind="ping"
      :width="width"
      :height="height"
    />
  </div>
</template>
