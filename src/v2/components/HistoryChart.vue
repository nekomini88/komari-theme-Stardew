<script setup lang="ts">
/**
 * HistoryChart —— 历史/延迟曲线（手绘平滑，圆角抗锯齿笔触）
 *
 * 计算全部下沉到 @/v2/data/history 的纯函数（buildChartModel / toPathD / gridLines）：
 *  - 空数据 → 占位块（data-testid="chart-empty"），不画 SVG
 *  - 单点 → 只画一个方块点，不画线
 *  - 断点（null）→ 曲线切段，不跨断点连线
 *  - 全等值 / 极值 → 归一化走中线 / 线性映射，无除零
 * 视觉取色全部走 tokens（--vk-*，见 src/styles/v2/chart.css），组件不含裸色值。
 */
import type { Series } from '@/v2/data/types'
import { computed } from 'vue'
import { buildChartModel, gridLines, toPathD } from '@/v2/data/history'
import { roundTo } from '@/v2/data/metrics'

const props = withDefaults(defineProps<{
  series: Series | null | undefined
  title?: string
  /** 数值单位后缀，如 'ms' / '%' */
  unit?: string
  width?: number
  height?: number
  /** 曲线主题（着色），默认 load */
  seriesKind?: 'load' | 'ping'
}>(), {
  title: '',
  unit: '',
  width: 220,
  height: 64,
  seriesKind: 'load',
})

const model = computed(() => buildChartModel(props.series, {
  width: props.width,
  height: props.height,
  padding: 6,
}))

const gridY = computed(() => gridLines(model.value, 3))

/** 只有 >=2 个点的段才画线（单点走方块标记） */
const lineSegments = computed(() => model.value.segments.filter(seg => seg.length >= 2))

const minText = computed(() => `${roundTo(model.value.min, 1)}${props.unit}`)
const maxText = computed(() => `${roundTo(model.value.max, 1)}${props.unit}`)

const ariaLabel = computed(() => {
  if (model.value.empty)
    return `${props.title || '数据'} 暂无数据`
  return `${props.title || '数据'}：${model.value.count} 个点，范围 ${minText.value} 至 ${maxText.value}`
})
</script>

<template>
  <figure class="vk-chart" :data-testid="'chart'" :data-empty="model.empty" :data-single="model.single">
    <figcaption v-if="title" class="vk-chart-title">
      {{ title }}
    </figcaption>

    <div class="vk-chart-plot">
      <div v-if="model.empty" class="vk-chart-empty" data-testid="chart-empty">
        <span class="vk-chart-empty-mark" aria-hidden="true" />
        <span>暂无数据</span>
      </div>

      <svg
        v-else
        class="vk-chart-svg"
        :width="width"
        :height="height"
        :viewBox="`0 0 ${width} ${height}`"
        role="img"
        :aria-label="ariaLabel"
        preserveAspectRatio="none"
      >
        <!-- 网格 -->
        <line
          v-for="(gy, i) in gridY"
          :key="`grid-${i}`"
          class="vk-chart-grid"
          :x1="0"
          :y1="gy"
          :x2="width"
          :y2="gy"
        />
        <!-- 外框 -->
        <rect class="vk-chart-frame" x="0.5" y="0.5" :width="Math.max(width - 1, 0)" :height="Math.max(height - 1, 0)" />
        <!-- 连续曲线（断点处为独立段） -->
        <path
          v-for="(seg, i) in lineSegments"
          :key="`seg-${i}`"
          class="vk-chart-line"
          :data-series="seriesKind"
          :d="toPathD(seg)"
        />
        <!-- 单点：圆点标记（手绘平滑笔触） -->
        <circle
          v-for="(p, i) in model.points"
          v-show="model.single"
          :key="`pt-${i}`"
          class="vk-chart-dot"
          :cx="p.x"
          :cy="p.y"
          r="3"
        />
      </svg>
    </div>

    <div v-if="!model.empty" class="vk-chart-axis" data-testid="chart-axis">
      <span>{{ minText }}</span>
      <span>{{ model.count }} 点</span>
      <span>{{ maxText }}</span>
    </div>
  </figure>
</template>
