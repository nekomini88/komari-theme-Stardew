<script setup lang="ts">
/**
 * NodeCard —— 节点卡片（住在 SceneStack 的 mid 层，ART_SYSTEM §2）
 *
 * 展示：彩色标题栏（图标 + 居中名称 + 状态）/ CPU% / 内存% / 硬盘% / 上下行 / 负载 /
 *       在线时长 / 累计流量 / 延迟 / 到期时间（Expire）。
 * 约束：
 *  - 所有数值统一走 @/v2/data/metrics 的格式化函数，组件内不做任何自造格式。
 *  - 视觉全部取自母板/tokens：柔和投影、圆角、无硬边像素描边（笔触平滑）。
 *  - 标题栏主题色按 uuid 稳定映射到母板 --vk-accent-*，同一台每次同色。
 *  - 小图标统一走 Iconify（@iconify/vue，仓内既有图标管线），不使用像素 sprite。
 *  - 状态用「颜色 + 文字」双重区分（nodeStatus.ts），不只靠颜色。
 */
import { Icon } from '@iconify/vue'
import type { Node } from '@/v2/data/types'
import { computed } from 'vue'
import {
  formatBytes,
  formatBytesPerSecond,
  formatDate,
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
/** 到期时间：expired_at 缺失/非法 → '—' */
const expireText = computed(() => formatDate(node.value.expiredAt))

/** 各资源使用率等级（着色用） */
const cpuLevel = computed(() => usageLevel(node.value.cpu))
const memLevel = computed(() => usageLevel(percentValue(node.value.ram, node.value.ramTotal)))
const diskLevel = computed(() => usageLevel(percentValue(node.value.disk, node.value.diskTotal)))

/** 顶部彩色标题栏主题色：按 uuid 稳定映射到 8 个母板色令牌（每台一个色，可辨且不串色） */
const CARD_ACCENTS = [
  'var(--vk-accent-1)',
  'var(--vk-accent-2)',
  'var(--vk-accent-3)',
  'var(--vk-accent-4)',
  'var(--vk-accent-5)',
  'var(--vk-accent-6)',
  'var(--vk-accent-7)',
  'var(--vk-accent-8)',
] as const

const accent = computed(() => {
  const key = node.value.uuid || node.value.name
  let h = 0
  for (let i = 0; i < key.length; i++)
    h = (h * 31 + key.charCodeAt(i)) >>> 0
  return CARD_ACCENTS[h % CARD_ACCENTS.length]
})
</script>

<template>
  <article
    class="vk-node-card vk-contact"
    :data-node-id="node.uuid"
    :data-status="viewStatus"
    :style="{ '--vk-node-accent': accent }"
  >
    <header class="vk-card-head">
      <span class="vk-card-head-icon" aria-hidden="true">
        <Icon icon="tabler:server-2" :width="15" :height="15" />
      </span>
      <span class="vk-card-name" :title="node.name">{{ node.name }}</span>
      <span class="vk-card-status" :data-status="viewStatus">{{ statusLabel }}</span>
    </header>

    <div class="vk-card-body">
      <ul class="vk-card-metrics">
      <li class="vk-card-metric" data-metric="cpu">
        <span class="vk-metric-label">
          <Icon class="vk-icon-inline" icon="tabler:cpu" :width="13" :height="13" />CPU
        </span>
        <span class="vk-metric-value" data-field="cpu">{{ cpuPctText }}</span>
        <span class="vk-meter" :data-level="cpuLevel">
          <span class="vk-meter-fill" :style="{ width: `${cpuPctValue}%` }" />
        </span>
      </li>
      <li class="vk-card-metric" data-metric="mem">
        <span class="vk-metric-label">
          <Icon class="vk-icon-inline" icon="tabler:memory" :width="13" :height="13" />内存
        </span>
        <span class="vk-metric-value" data-field="mem">{{ memPctText }}</span>
        <span class="vk-meter" :data-level="memLevel">
          <span class="vk-meter-fill" :style="{ width: `${memPctValue}%` }" />
        </span>
        <span class="vk-metric-sub" data-field="mem-detail">{{ memText }}</span>
      </li>
      <li class="vk-card-metric" data-metric="disk">
        <span class="vk-metric-label">
          <Icon class="vk-icon-inline" icon="tabler:device-sd-card" :width="13" :height="13" />硬盘
        </span>
        <span class="vk-metric-value" data-field="disk">{{ diskPctText }}</span>
        <span class="vk-meter" :data-level="diskLevel">
          <span class="vk-meter-fill" :style="{ width: `${diskPctValue}%` }" />
        </span>
        <span class="vk-metric-sub" data-field="disk-detail">{{ diskText }}</span>
      </li>
    </ul>

    <dl class="vk-card-facts">
      <div class="vk-fact">
        <dt><Icon class="vk-icon-inline" icon="tabler:arrow-down" :width="12" :height="12" />下行</dt>
        <dd data-field="net-in">{{ netInText }}</dd>
      </div>
      <div class="vk-fact">
        <dt><Icon class="vk-icon-inline" icon="tabler:arrow-up" :width="12" :height="12" />上行</dt>
        <dd data-field="net-out">{{ netOutText }}</dd>
      </div>
      <div class="vk-fact">
        <dt><Icon class="vk-icon-inline" icon="tabler:gauge" :width="12" :height="12" />负载</dt>
        <dd data-field="load">{{ loadText }} ({{ loadPctText }})</dd>
      </div>
      <div class="vk-fact">
        <dt><Icon class="vk-icon-inline" icon="tabler:clock" :width="12" :height="12" />在线</dt>
        <dd data-field="uptime">{{ uptimeText }}</dd>
      </div>
      <div class="vk-fact">
        <dt><Icon class="vk-icon-inline" icon="tabler:download" :width="12" :height="12" />累计↓</dt>
        <dd data-field="traffic-down">{{ trafficDownText }}</dd>
      </div>
      <div class="vk-fact">
        <dt><Icon class="vk-icon-inline" icon="tabler:upload" :width="12" :height="12" />累计↑</dt>
        <dd data-field="traffic-up">{{ trafficUpText }}</dd>
      </div>
      <div class="vk-fact">
        <dt><Icon class="vk-icon-inline" icon="tabler:activity" :width="12" :height="12" />延迟</dt>
        <dd data-field="latency">{{ latencyText }}</dd>
      </div>
      <div class="vk-fact">
        <dt><Icon class="vk-icon-inline" icon="tabler:calendar-event" :width="12" :height="12" />到期</dt>
        <dd data-field="expire" :title="node.expiredAt ?? ''">{{ expireText }}</dd>
      </div>
    </dl>

    <footer class="vk-card-foot">
      <span v-if="node.region" class="vk-card-region" :title="node.region">{{ node.region }}</span>
      <span class="vk-card-os" :title="node.os">{{ node.os }}</span>
    </footer>
    </div>
  </article>
</template>
