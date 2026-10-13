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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  formatBytesPerSecond,
  formatDate,
  formatLatency,
  formatBytes,
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
import { getOSImage } from '@/utils/osImageHelper'
import { loadPingSeries, SAMPLE_SLOTS, type PingSeries } from '@/v2/data/pingSamples'

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

/* 实际容量明细（用户口径：只有百分比没有关键信息）：
   CPU  → 1/5/15 分钟负载 + 核数，形如 0.00, 0.00, 0.00 (1c)
   Memory / Disk → 已用 / 总量，形如 245.7 MB / 932.3 MB */
const cpuDetailText = computed(() => {
  const n = node.value
  const trio = [n.load, n.load5, n.load15].map(v => formatLoad(v)).join(', ')
  const cores = n.cpuCores > 0 ? ` (${n.cpuCores}c)` : ''
  return trio + cores
})
const memDetailText = computed(() => {
  const n = node.value
  if (!n.ramTotal)
    return formatBytes(n.ram)
  return `${formatBytes(n.ram)} / ${formatBytes(n.ramTotal)}`
})
const diskDetailText = computed(() => {
  const n = node.value
  if (!n.diskTotal)
    return formatBytes(n.disk)
  return `${formatBytes(n.disk)} / ${formatBytes(n.diskTotal)}`
})
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

/** 操作系统图标（放国旗旁边，参考 komari.vickypig.com）。
 *  node.os 为空时不渲染 —— 不给"未知系统"的默认图，免得图标与实际系统对不上。 */
const osIconSrc = computed(() => (node.value.os ? getOSImage(node.value.os) : ''))

/**
 * 延迟 / 丢包的「格子条」—— 一格一个真实样本，口径对齐参考站 komari.vickypig.com
 * （用户 2026-10-13：「按照参考站来」）。
 * 旧做法是 `width: min(100, latency)%`，把毫秒当百分比 → 135ms 就顶满格，语义错。
 * 数据走 `common:getRecords {type:'ping'}`；详细口径见 @/v2/data/pingSamples。
 */
function emptySeries(): PingSeries {
  const blank = (level: 'none' | 'crit') => ({
    level,
    value: null,
    at: '--:--',
    title: '无数据',
  })
  return {
    latency: Array.from({ length: SAMPLE_SLOTS }, () => blank('none')),
    loss: Array.from({ length: SAMPLE_SLOTS }, () => blank('crit')),
  }
}
const series = ref<PingSeries>(emptySeries())
let seriesTimer: ReturnType<typeof setInterval> | null = null

async function refreshSeries() {
  series.value = await loadPingSeries(props.node.uuid)
}

onMounted(() => {
  void refreshSeries()
  seriesTimer = setInterval(() => void refreshSeries(), 120_000)
})

onBeforeUnmount(() => {
  if (seriesTimer)
    clearInterval(seriesTimer)
})

/** 进度条颜色：Load 用橙，其余用绿（对齐参考稿） */
/* 进度条绿：参考稿实测为高饱和亮绿 #2a9708（此前用旧母板的 --vk-leaf #7fa851，偏灰、与参考稿不一致） */
const GREEN = 'var(--vk-ref-leaf)'
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
      // 每台一个不同的角饰（用户 2026-10-13：装饰物要做成不同物品）
      '--vk-orn': `var(--vk-orn-${accentSlot + 1})`,
    }"
  >
    <!-- ① 绿色木匾标题栏 -->
    <header class="vk-card-head vk-panel-head">
      <!-- 参考稿横幅里没有图标：左端只保留横幅自身的叶簇装饰。
           原先在左端挂 32px 图标，使名称在视觉上被压得偏左（实测几何居中但观感失衡） -->
      <!-- 名称外壳：收缩到名称自身宽度并作为定位祖先。
           用户 2026-10-13「国旗和 os 图标放的太割裂了」的根治办法 —— 徽标用 left:100% 相对
           **本壳**绝对定位，与栅格轨道的松紧完全无关，因此每张卡恒定只隔 8px；
           而本壳在栅格里居中 ⇒ 名称仍然精确居中（内部绝对定位的徽标不参与尺寸计算）。 -->
      <!-- 状态点按参考站放**最左**：参考站实测元素顺序为
           状态点 x=12 → 服务器名 x=32 → OS 图标 x=243 → 国旗 x=267（最右） -->
      <span class="vk-panel-dot" :data-status="viewStatus" :title="statusLabel" aria-hidden="true" />
      <span class="vk-name-wrap">
        <h3 class="vk-card-name vk-panel-name" :title="node.name">{{ node.name }}</h3>
        <span class="vk-panel-meta">
          <!-- 操作系统图标（用户口径：参考 komari.vickypig.com，放在国旗旁边）
               参考站顺序 = [OS 16px] + 缝 + [国旗]；素材走既有 osImageHelper（未匹配时给默认图，不会破图） -->
          <span v-if="osIconSrc" class="vk-panel-osicon" :title="node.os">
            <img :src="osIconSrc" :alt="node.os" loading="lazy">
          </span>
          <span v-if="flagCode" class="vk-panel-flag" :title="node.region">
            <img :src="`/images/flags/${flagCode}.svg`" :alt="node.region" loading="lazy">
          </span>
        </span>
      </span>
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
            <span class="vk-cell-detail" data-field="cpu-detail">{{ cpuDetailText }}</span>
          </div>
          <div class="vk-cell">
            <PixelIcon name="memory" :size="16" />
            <span class="vk-cell-label">Memory</span>
            <span class="vk-cell-value" data-field="mem">{{ memPctText }}</span>
            <span class="vk-seg" :data-level="usageLevel(memPct)" :style="{ '--vk-seg-color': GREEN }">
              <span class="vk-seg-fill" :style="{ width: `${memPct}%` }" />
            </span>
            <span class="vk-cell-detail" data-field="mem-detail">{{ memDetailText }}</span>
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
            <span class="vk-cell-detail" data-field="disk-detail">{{ diskDetailText }}</span>
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
            <span class="vk-samples" aria-hidden="true">
              <span
                v-for="(s, i) in series.latency"
                :key="i"
                class="vk-sample"
                :data-level="s.level"
                :title="s.title"
              />
            </span>
          </div>
          <div class="vk-cell">
            <PixelIcon name="shield" :size="16" />
            <span class="vk-cell-label">Packet Loss</span>
            <span class="vk-cell-value" data-field="loss">{{ lossText }}</span>
            <span class="vk-samples" aria-hidden="true">
              <span
                v-for="(s, i) in series.loss"
                :key="i"
                class="vk-sample"
                :data-level="s.level"
                :title="s.title"
              />
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
