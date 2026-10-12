<script setup lang="ts">
/**
 * NodeCard —— 节点卡片（**木牌面板**，复刻《星露谷物语主题.pdf》）
 *
 * 参考稿结构（逐项对齐）：
 *   ① 绿色木匾标题栏：叶片/藤蔓装饰 + 路由图标 + 白色粗体节点名 + 右侧国旗 + 右上角状态灯
 *   ② 奶油色纸/浅木纹主体：深棕 1px 描边、圆角
 *   ③ 系统行：`os · arch · 虚拟化`（整宽，左侧一枚系统图标）
 *   ④ 之后每行两列，行间有浅色细横线：
 *        CPU% / Memory%   → Disk% / Load
 *        ↑Upload / ↓Download → Outbound / Inbound
 *        Latency / Packet Loss → Expires / Uptime
 *   ⑤ 进度条：圆角长槽 + 一排小方块（分段式）；CPU/Mem/Disk/Latency/Loss 绿，**Load 橙**
 *   ⑥ 数值文字用蓝、标签用深棕
 *
 * 约束：
 *  - 数值一律走 @/v2/data/metrics 的格式化函数，组件内不自造格式。
 *  - 图标走 @/components/PixelIcon.vue（像素 sprite，缺图自动回落 Iconify）。
 *  - 视觉取色 ⊆ tokens.css 的母板令牌，不写死十六进制。
 *  - 状态用「颜色 + 文字」双重区分（nodeStatus.ts），不只靠颜色。
 */
import PixelIcon from '@/components/PixelIcon.vue'
import type { Node } from '@/v2/data/types'
import { computed } from 'vue'
import {
  formatBytes,
  formatBytesPerSecond,
  formatDate,
  formatLatency,
  formatLoad,
  formatLoadPercent,
  formatLoss,
  formatPercent,
  formatUptime,
  percentValue,
  usageLevel,
} from '@/v2/data/metrics'
import { nodeStatusLabel, nodeViewStatus } from '@/v2/data/nodeStatus'
import { getRegionCode } from '@/utils/regionHelper'

const props = defineProps<{ node: Node, accentIndex?: number }>()

const node = computed(() => props.node)

/** 标题栏色槽数（与 tokens.css 的 --vk-node-ink-1..6 / --vk-node-shadow-1..6 一致，
 *  色彩本身由 public/images/v2-panel/panel-1..6.png 提供） */
const ACCENT_SLOTS = 6

/** 标题栏色槽：优先用父级（HomeView）按**全量**节点分配的 accentIndex
 *  （同批 ≤6 台互不同色，见 nodeModel.assignAccents）；独立使用时退化为 uuid 哈希。
 *  参考稿本身就是「每台一色」，配色取参考稿实测的绿/蓝/紫/粉/橙/青。 */
const accentSlot = computed(() => {
  const idx = props.accentIndex
  if (typeof idx === 'number' && Number.isFinite(idx) && idx >= 0)
    return idx % ACCENT_SLOTS
  const key = node.value.uuid || node.value.name
  let h = 0
  for (let i = 0; i < key.length; i++)
    h = (h * 31 + key.charCodeAt(i)) >>> 0
  return h % ACCENT_SLOTS
})

const viewStatus = computed(() => nodeViewStatus(node.value))
const statusLabel = computed(() => nodeStatusLabel(viewStatus.value))

/* ---- 指标文案与进度条取值（全部经 metrics） ---- */
const cpuPctText = computed(() => formatPercent(node.value.cpu, 100))
const cpuPct = computed(() => percentValue(node.value.cpu, 100))

const memPctText = computed(() => formatPercent(node.value.ram, node.value.ramTotal))
const memPct = computed(() => percentValue(node.value.ram, node.value.ramTotal))

const diskPctText = computed(() => formatPercent(node.value.disk, node.value.diskTotal))
const diskPct = computed(() => percentValue(node.value.disk, node.value.diskTotal))

const loadText = computed(() => formatLoad(node.value.load))
const loadPct = computed(() => percentValue(node.value.load, node.value.cpuCores))

const latencyText = computed(() => formatLatency(node.value.latency))
const lossText = computed(() => formatLoss(node.value.loss))

const uptimeText = computed(() => formatUptime(node.value.uptime))
const expireText = computed(() => formatDate(node.value.expiredAt))

/** 上下行（实时速率）：↑Upload = 上行(netOut)，↓Download = 下行(netIn) */
const uploadText = computed(() => formatBytesPerSecond(node.value.netOut))
const downloadText = computed(() => formatBytesPerSecond(node.value.netIn))
/** 累计流量：Outbound = 累计上行，Inbound = 累计下行 */
const outboundText = computed(() => formatBytes(node.value.netTotalUp))
const inboundText = computed(() => formatBytes(node.value.netTotalDown))

/** 系统行：os · arch · 虚拟化（缺项自动跳过，不留空点） */
const sysLine = computed(() => {
  const n = node.value
  return [n.os, n.arch, n.virtualization].filter(v => typeof v === 'string' && v.trim() !== '').join(' · ')
})

/** 地区 → ISO 码 → 国旗素材；解析不出则不渲染国旗 */
const flagCode = computed(() => {
  const code = getRegionCode(node.value.region ?? '')
  return code && /^[A-Z]{2}$/.test(code) ? code : null
})

/** 进度条颜色：Load 用橙，其余用绿（对齐参考稿） */
const GREEN = 'var(--vk-leaf)'
const ORANGE = 'var(--vk-honey)'

defineExpose({ viewStatus, statusLabel })
</script>

<template>
  <article
    class="vk-node-card vk-panel"
    :data-node-id="node.uuid"
    :data-status="viewStatus"
    :data-accent="accentSlot + 1"
    :style="{
      '--vk-node-ink': `var(--vk-node-ink-${accentSlot + 1})`,
      '--vk-node-shadow': `var(--vk-node-shadow-${accentSlot + 1})`,
      '--vk-panel-art': `url(/images/v2-panel/panel-${accentSlot + 1}.png)`,
    }"
  >
    <!-- ① 绿色木匾标题栏 -->
    <header class="vk-card-head vk-panel-head">
      <span class="vk-card-head-icon vk-panel-head-icon" aria-hidden="true">
        <PixelIcon name="server" :size="32" />
      </span>
      <h3 class="vk-card-name vk-panel-name" :title="node.name">{{ node.name }}</h3>
      <span v-if="flagCode" class="vk-panel-flag" :title="node.region">
        <img :src="`/images/flags/${flagCode}.svg`" :alt="node.region" loading="lazy">
      </span>
      <!-- 视觉上是参考稿的状态圆点；状态文字作为 tooltip + 无障碍标签，保证不只靠颜色区分 -->
      <span class="vk-panel-dot" :data-status="viewStatus" :title="statusLabel" aria-hidden="true" />
      <span class="vk-card-status vk-visually-hidden">{{ statusLabel }}</span>
    </header>

    <!-- ② 奶油色纸主体 -->
    <div class="vk-card-body vk-panel-body">
      <!-- ③ 系统行 -->
      <p v-if="sysLine" class="vk-panel-sys">
        <PixelIcon name="desktop" :size="16" />
        <span>{{ sysLine }}</span>
      </p>

      <!-- ④ 指标行：每行两列 -->
      <div class="vk-panel-rows">
        <!-- CPU / Memory -->
        <div class="vk-panel-row">
          <div class="vk-cell">
            <PixelIcon name="cpu" :size="16" />
            <span class="vk-cell-label">CPU</span>
            <span class="vk-cell-value" data-field="cpu">{{ cpuPctText }}</span>
            <span class="vk-seg" :data-level="usageLevel(node.cpu)" :style="{ '--vk-seg-color': GREEN }">
              <span class="vk-seg-fill" :style="{ width: `${cpuPct}%` }" />
            </span>
          </div>
          <div class="vk-cell">
            <PixelIcon name="memory" :size="16" />
            <span class="vk-cell-label">Memory</span>
            <span class="vk-cell-value" data-field="mem">{{ memPctText }}</span>
            <span class="vk-seg" :data-level="usageLevel(memPct)" :style="{ '--vk-seg-color': GREEN }">
              <span class="vk-seg-fill" :style="{ width: `${memPct}%` }" />
            </span>
          </div>
        </div>

        <!-- Disk / Load -->
        <div class="vk-panel-row">
          <div class="vk-cell">
            <PixelIcon name="hard-disk" :size="16" />
            <span class="vk-cell-label">Disk</span>
            <span class="vk-cell-value" data-field="disk">{{ diskPctText }}</span>
            <span class="vk-seg" :data-level="usageLevel(diskPct)" :style="{ '--vk-seg-color': GREEN }">
              <span class="vk-seg-fill" :style="{ width: `${diskPct}%` }" />
            </span>
          </div>
          <div class="vk-cell">
            <PixelIcon name="dashboard" :size="16" />
            <span class="vk-cell-label">Load</span>
            <span class="vk-cell-value" data-field="load">{{ loadText }}</span>
            <span class="vk-seg" :style="{ '--vk-seg-color': ORANGE }">
              <span class="vk-seg-fill" :style="{ width: `${loadPct}%` }" />
            </span>
          </div>
        </div>

        <!-- Upload / Download -->
        <div class="vk-panel-row">
          <div class="vk-cell">
            <PixelIcon name="traffic-up" :size="16" />
            <span class="vk-cell-label">Upload</span>
            <span class="vk-cell-value" data-field="net-out">{{ uploadText }}</span>
          </div>
          <div class="vk-cell">
            <PixelIcon name="traffic-down" :size="16" />
            <span class="vk-cell-label">Download</span>
            <span class="vk-cell-value" data-field="net-in">{{ downloadText }}</span>
          </div>
        </div>

        <!-- Outbound / Inbound -->
        <div class="vk-panel-row">
          <div class="vk-cell">
            <PixelIcon name="transfer" :size="16" />
            <span class="vk-cell-label">Outbound</span>
            <span class="vk-cell-value" data-field="traffic-up">{{ outboundText }}</span>
          </div>
          <div class="vk-cell">
            <PixelIcon name="globe" :size="16" />
            <span class="vk-cell-label">Inbound</span>
            <span class="vk-cell-value" data-field="traffic-down">{{ inboundText }}</span>
          </div>
        </div>

        <!-- Latency / Packet Loss -->
        <div class="vk-panel-row">
          <div class="vk-cell">
            <PixelIcon name="clock" :size="16" />
            <span class="vk-cell-label">Latency</span>
            <span class="vk-cell-value" data-field="latency">{{ latencyText }}</span>
            <span class="vk-seg" :style="{ '--vk-seg-color': GREEN }">
              <span class="vk-seg-fill" :style="{ width: `${Math.min(100, node.latency || 0)}%` }" />
            </span>
          </div>
          <div class="vk-cell">
            <PixelIcon name="shield" :size="16" />
            <span class="vk-cell-label">Packet Loss</span>
            <span class="vk-cell-value" data-field="loss">{{ lossText }}</span>
            <span class="vk-seg" :style="{ '--vk-seg-color': GREEN }">
              <span class="vk-seg-fill" :style="{ width: `${Math.min(100, node.loss || 0)}%` }" />
            </span>
          </div>
        </div>

        <!-- Expires / Uptime -->
        <div class="vk-panel-row">
          <div class="vk-cell">
            <PixelIcon name="calendar" :size="16" />
            <span class="vk-cell-label">Expires</span>
            <span class="vk-cell-value" data-field="expire" :title="node.expiredAt ?? ''">{{ expireText }}</span>
          </div>
          <div class="vk-cell">
            <PixelIcon name="hourglass" :size="16" />
            <span class="vk-cell-label">Uptime</span>
            <span class="vk-cell-value" data-field="uptime">{{ uptimeText }}</span>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
