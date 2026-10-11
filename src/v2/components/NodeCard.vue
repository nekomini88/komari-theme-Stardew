<script setup lang="ts">
/**
 * NodeCard —— 节点卡片（住在 SceneStack 的 mid 层，ART_SYSTEM §2）
 *
 * 展示：名称 / 地区 / 在线状态 + CPU% / 内存% / 硬盘% / 上下行流量 / 负载 / 在线时长。
 * 约束：
 *  - 所有数值统一走 @/v2/data/metrics 的格式化函数，组件内不做任何自造格式。
 *  - 视觉全部取自母板/tokens：1px(#2b1d16→--vk-outline) 描边、硬边、无渐变/模糊/发光/半透明叠色。
 *  - 底部对齐共享 ground 基线 + 接触阴影（.vk-contact），不浮空。
 *  - 状态用「颜色 + 文字」双重区分（nodeStatus.ts），不只靠颜色。
 */
import type { Node } from '@/v2/data/types'
import { computed } from 'vue'
import {
  formatBytes,
  formatBytesPerSecond,
  formatLoad,
  formatLoadPercent,
  formatLatency,
  formatPercent,
  formatUptime,
  percentValue,
  usageLevel,
} from '@/v2/data/metrics'
import { nodeStatusLabel, nodeViewStatus } from '@/v2/data/nodeStatus'

const props = defineProps<{ node: Node }>()

const node = computed(() => props.node)

const viewStatus = computed(() => nodeViewStatus(node.value))
const statusLabel = computed(() => nodeStatusLabel(viewStatus.value))

/** 资源百分比文案/进度条宽度（全部经 metrics，不另写格式化） */
const cpuPctText = computed(() => formatPercent(node.value.cpu, 100))
const cpuPctValue = computed(() => percentValue(node.value.cpu, 100))

const memPctText = computed(() => formatPercent(node.value.ram, node.value.ramTotal))
const memPctValue = computed(() => percentValue(node.value.ram, node.value.ramTotal))
const memText = computed(() => `${formatBytes(node.value.ram)} / ${formatBytes(node.value.ramTotal)}`)

const diskPctText = computed(() => formatPercent(node.value.disk, node.value.diskTotal))
const diskPctValue = computed(() => percentValue(node.value.disk, node.value.diskTotal))
const diskText = computed(() => `${formatBytes(node.value.disk)} / ${formatBytes(node.value.diskTotal)}`)

const netInText = computed(() => formatBytesPerSecond(node.value.netIn))
const netOutText = computed(() => formatBytesPerSecond(node.value.netOut))
const trafficDownText = computed(() => formatBytes(node.value.netTotalDown))
const trafficUpText = computed(() => formatBytes(node.value.netTotalUp))

const loadText = computed(() => formatLoad(node.value.load))
const loadPctText = computed(() => formatLoadPercent(node.value.load, node.value.cpuCores))
const uptimeText = computed(() => formatUptime(node.value.uptime))
const latencyText = computed(() => formatLatency(node.value.latency))

/** 各资源使用率等级（着色用） */
const cpuLevel = computed(() => usageLevel(node.value.cpu))
const memLevel = computed(() => usageLevel(percentValue(node.value.ram, node.value.ramTotal)))
const diskLevel = computed(() => usageLevel(percentValue(node.value.disk, node.value.diskTotal)))
</script>

<template>
  <article
    class="vk-node-card vk-contact vk-pixel"
    :data-node-id="node.uuid"
    :data-status="viewStatus"
  >
    <header class="vk-card-head">
      <div class="vk-card-title">
        <span class="vk-card-name" :title="node.name">{{ node.name }}</span>
        <span v-if="node.region" class="vk-card-region" :title="node.region">{{ node.region }}</span>
      </div>
      <span class="vk-card-status" :data-status="viewStatus">{{ statusLabel }}</span>
    </header>

    <ul class="vk-card-metrics">
      <li class="vk-card-metric" data-metric="cpu">
        <span class="vk-metric-label">CPU</span>
        <span class="vk-metric-value" data-field="cpu">{{ cpuPctText }}</span>
        <span class="vk-meter" :data-level="cpuLevel">
          <span class="vk-meter-fill" :style="{ width: `${cpuPctValue}%` }" />
        </span>
      </li>
      <li class="vk-card-metric" data-metric="mem">
        <span class="vk-metric-label">内存</span>
        <span class="vk-metric-value" data-field="mem">{{ memPctText }}</span>
        <span class="vk-meter" :data-level="memLevel">
          <span class="vk-meter-fill" :style="{ width: `${memPctValue}%` }" />
        </span>
        <span class="vk-metric-sub" data-field="mem-detail">{{ memText }}</span>
      </li>
      <li class="vk-card-metric" data-metric="disk">
        <span class="vk-metric-label">硬盘</span>
        <span class="vk-metric-value" data-field="disk">{{ diskPctText }}</span>
        <span class="vk-meter" :data-level="diskLevel">
          <span class="vk-meter-fill" :style="{ width: `${diskPctValue}%` }" />
        </span>
        <span class="vk-metric-sub" data-field="disk-detail">{{ diskText }}</span>
      </li>
    </ul>

    <dl class="vk-card-facts">
      <div class="vk-fact">
        <dt>下行</dt>
        <dd data-field="net-in">{{ netInText }}</dd>
      </div>
      <div class="vk-fact">
        <dt>上行</dt>
        <dd data-field="net-out">{{ netOutText }}</dd>
      </div>
      <div class="vk-fact">
        <dt>负载</dt>
        <dd data-field="load">{{ loadText }} ({{ loadPctText }})</dd>
      </div>
      <div class="vk-fact">
        <dt>在线</dt>
        <dd data-field="uptime">{{ uptimeText }}</dd>
      </div>
      <div class="vk-fact">
        <dt>累计↓</dt>
        <dd data-field="traffic-down">{{ trafficDownText }}</dd>
      </div>
      <div class="vk-fact">
        <dt>累计↑</dt>
        <dd data-field="traffic-up">{{ trafficUpText }}</dd>
      </div>
      <div class="vk-fact">
        <dt>延迟</dt>
        <dd data-field="latency">{{ latencyText }}</dd>
      </div>
    </dl>

    <footer class="vk-card-foot">
      <span class="vk-card-os" :title="node.os">{{ node.os }}</span>
    </footer>
  </article>
</template>
