<script setup lang="ts">
/**
 * OverviewBar —— 首页顶部总览（在线台数/总台数、平均 CPU/内存、总上下行等）
 *
 * 所有聚合与文案来自纯函数 @/v2/data/overviewStats.buildOverviewStats（可单测）。
 * 视觉取自母板/tokens：直角、硬边、右下硬阴影、无渐变/模糊。
 */
import type { Node } from '@/v2/data/types'
import { computed } from 'vue'
import { buildOverviewStats } from '@/v2/data/overviewStats'

const props = defineProps<{ nodes: readonly Node[] }>()

const stats = computed(() => buildOverviewStats(props.nodes))
</script>

<template>
  <section class="vk-overview" data-testid="overview" aria-label="节点总览">
    <div class="vk-overview-item" data-field="online">
      <span class="vk-overview-label">在线/总数</span>
      <span class="vk-overview-value">{{ stats.onlineText }}</span>
    </div>
    <div v-if="stats.alert > 0" class="vk-overview-item" data-field="alert">
      <span class="vk-overview-label">告警</span>
      <span class="vk-overview-value">{{ stats.alert }}</span>
    </div>
    <div class="vk-overview-item" data-field="cpu">
      <span class="vk-overview-label">平均 CPU</span>
      <span class="vk-overview-value">{{ stats.cpuText }}</span>
    </div>
    <div class="vk-overview-item" data-field="ram">
      <span class="vk-overview-label">内存</span>
      <span class="vk-overview-value">{{ stats.ramPctText }}</span>
      <span class="vk-overview-sub">{{ stats.ramText }}</span>
    </div>
    <div class="vk-overview-item" data-field="disk">
      <span class="vk-overview-label">硬盘</span>
      <span class="vk-overview-value">{{ stats.diskPctText }}</span>
      <span class="vk-overview-sub">{{ stats.diskText }}</span>
    </div>
    <div class="vk-overview-item" data-field="net-in">
      <span class="vk-overview-label">总下行</span>
      <span class="vk-overview-value">{{ stats.netInText }}</span>
    </div>
    <div class="vk-overview-item" data-field="net-out">
      <span class="vk-overview-label">总上行</span>
      <span class="vk-overview-value">{{ stats.netOutText }}</span>
    </div>
    <div class="vk-overview-item" data-field="traffic">
      <span class="vk-overview-label">累计流量</span>
      <span class="vk-overview-value">{{ stats.trafficText }}</span>
    </div>
    <div class="vk-overview-item" data-field="latency">
      <span class="vk-overview-label">平均延迟</span>
      <span class="vk-overview-value">{{ stats.latencyText }}</span>
    </div>
  </section>
</template>
