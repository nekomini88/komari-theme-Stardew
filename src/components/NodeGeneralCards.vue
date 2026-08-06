<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import type { CurrencyCode } from '@/utils/financeHelper'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import NodeEarthGlobe from '@/components/NodeEarthGlobe.vue'
import { CardX } from '@/components/ui/card-x'
import { DataTooltip } from '@/components/ui/data-tooltip'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import * as financeHelper from '@/utils/financeHelper'
import { formatBytesPerSecondSplit, formatBytesSplit } from '@/utils/helper'

const props = defineProps<{
  nodes?: NodeData[]
  globeNodes?: NodeData[]
  transitionKey?: string
}>()
const appStore = useAppStore()
const nodesStore = useNodesStore()
const exchangeRates = ref(financeHelper.DEFAULT_EXCHANGE_RATES)
const exchangeRateBaseCurrency = ref<CurrencyCode>('CNY')
const excludeFreeNodes = ref(true)
const financeRateCurrencies: CurrencyCode[] = ['CNY', 'USD', 'HKD', 'EUR', 'GBP', 'JPY']
const summaryNodes = computed(() => props.nodes ?? nodesStore.nodes)
const summaryTransitionKey = computed(() => props.transitionKey ?? summaryNodes.value.map(node => node.uuid).join('|'))
const metricSwitchTransitionProps = computed(() => ({
  ...(appStore.disablePageAnimation
    ? { css: false }
    : { name: 'metric-switch', mode: 'out-in' as const }),
}))

const openFinanceCard = ref(false)

function getMetricSwitchStyle(index: number): Record<string, string> {
  return {
    '--metric-switch-delay': `${index * 35}ms`,
  }
}

function setExchangeRateBaseCurrency(event: Event): void {
  const target = event.target as HTMLSelectElement
  exchangeRateBaseCurrency.value = financeHelper.normalizeCurrency(target.value)
  financeHelper.setStoredFinanceCurrency(exchangeRateBaseCurrency.value)
}

const totalSpeed = computed(() => {
  const onlineNodes = summaryNodes.value.filter(node => node.online)
  const up = onlineNodes.reduce((sum, node) => sum + (node.net_out || 0), 0)
  const down = onlineNodes.reduce((sum, node) => sum + (node.net_in || 0), 0)
  return { up, down }
})

const totalTraffic = computed(() => {
  const up = summaryNodes.value.reduce((sum, node) => sum + (node.net_total_up || 0), 0)
  const down = summaryNodes.value.reduce((sum, node) => sum + (node.net_total_down || 0), 0)
  return { up, down }
})

// ==================== 连接数汇总 ====================
const totalConnections = computed(() => {
  const onlineNodes = summaryNodes.value.filter(node => node.online)
  const tcp = onlineNodes.reduce((sum, node) => sum + (node.connections || 0), 0)
  const udp = onlineNodes.reduce((sum, node) => sum + (node.connections_udp || 0), 0)
  return { tcp, udp, total: tcp + udp }
})

function formatNumber(num: number): string {
  if (num >= 100000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toLocaleString('zh-CN')
}

const formattedTrafficUp = computed(() => formatBytesSplit(totalTraffic.value.up, appStore.byteDecimals))
const formattedTrafficDown = computed(() => formatBytesSplit(totalTraffic.value.down, appStore.byteDecimals))
const totalTrafficTooltip = computed(() => formatBytesSplit(totalTraffic.value.up + totalTraffic.value.down, appStore.byteDecimals))

const formattedSpeedUp = computed(() => formatBytesPerSecondSplit(totalSpeed.value.up, appStore.byteDecimals))
const formattedSpeedDown = computed(() => formatBytesPerSecondSplit(totalSpeed.value.down, appStore.byteDecimals))

// ==================== 内存 / 硬盘 汇总 ====================
// 离线节点的 ram / disk 为 0，不影响 used 求和；mem_total / disk_total 是静态库存信息，按全量统计
const totalMemory = computed(() => {
  let used = 0
  let total = 0
  for (const node of summaryNodes.value) {
    used += node.ram || 0
    total += node.mem_total || 0
  }
  return { used, total }
})

const totalDisk = computed(() => {
  let used = 0
  let total = 0
  for (const node of summaryNodes.value) {
    used += node.disk || 0
    total += node.disk_total || 0
  }
  return { used, total }
})

const formattedMemoryUsed = computed(() => formatBytesSplit(totalMemory.value.used, appStore.byteDecimals))
const formattedMemoryTotal = computed(() => formatBytesSplit(totalMemory.value.total, appStore.byteDecimals))
const formattedDiskUsed = computed(() => formatBytesSplit(totalDisk.value.used, appStore.byteDecimals))
const formattedDiskTotal = computed(() => formatBytesSplit(totalDisk.value.total, appStore.byteDecimals))

const remainingValueCNY = computed(() => {
  return financeHelper.calculateTotalRemainingValueCNY(summaryNodes.value, exchangeRates.value, excludeFreeNodes.value)
})
const targetExchangeRate = computed(() => exchangeRates.value[exchangeRateBaseCurrency.value] || 1)
const remainingValue = computed(() => {
  return remainingValueCNY.value * targetExchangeRate.value
})
const formattedRemainingValue = computed(() => {
  return financeHelper.formatFinanceAmount(remainingValue.value, exchangeRateBaseCurrency.value)
})
const totalValueCNY = computed(() => {
  return financeHelper.calculateTotalValueCNY(summaryNodes.value, exchangeRates.value, excludeFreeNodes.value)
})
const totalValue = computed(() => {
  return totalValueCNY.value * targetExchangeRate.value
})
const formattedTotalValue = computed(() => {
  return financeHelper.formatFinanceAmount(totalValue.value, exchangeRateBaseCurrency.value)
})
const monthlyAverageCostCNY = computed(() => {
  return financeHelper.calculateTotalMonthlyAverageCostCNY(summaryNodes.value, exchangeRates.value, excludeFreeNodes.value)
})
const monthlyAverageCost = computed(() => {
  return monthlyAverageCostCNY.value * targetExchangeRate.value
})
const formattedMonthlyAverageCost = computed(() => {
  return financeHelper.formatFinanceAmount(monthlyAverageCost.value, exchangeRateBaseCurrency.value)
})
const financeSummaryItems = computed(() => [
  {
    label: '总价值',
    icon: 'tabler:wallet',
    value: formattedTotalValue.value.value,
    symbol: formattedTotalValue.value.symbol,
    currency: formattedTotalValue.value.currency,
  },
  {
    label: '月均支出',
    icon: 'tabler:receipt-2',
    value: formattedMonthlyAverageCost.value.value,
    symbol: formattedMonthlyAverageCost.value.symbol,
    currency: `${formattedMonthlyAverageCost.value.currency}/月`,
  },
  {
    label: '剩余价值',
    icon: 'tabler:coins',
    value: formattedRemainingValue.value.value,
    symbol: formattedRemainingValue.value.symbol,
    currency: formattedRemainingValue.value.currency,
  },
])
const exchangeRateRows = computed(() => financeRateCurrencies.map((currency) => {
  const baseRate = exchangeRates.value[exchangeRateBaseCurrency.value] || 1
  const targetRate = exchangeRates.value[currency] || 1
  const rate = targetRate / baseRate

  return {
    currency,
    baseCurrency: exchangeRateBaseCurrency.value,
    baseSymbol: financeHelper.CURRENCY_SYMBOLS[exchangeRateBaseCurrency.value],
    targetSymbol: financeHelper.CURRENCY_SYMBOLS[currency],
    rate: new Intl.NumberFormat('zh-CN', {
      maximumFractionDigits: 6,
      minimumFractionDigits: 6,
    }).format(rate),
  }
}))
const showEarth = computed(() => !appStore.hideEarth)
const wrapperClass = computed(() => showEarth.value
  ? 'p-4 grid grid-cols-12 grid-rows-1 gap-2 h-auto md:h-58'
  : 'p-4 grid grid-cols-1 gap-2 h-auto')
const cardGridClass = computed(() => showEarth.value
  ? 'h-42 -mt-42 md:mt-0 col-span-12 row-start-3 z-9 md:h-auto md:col-span-6 md:row-start-1 grid grid-cols-12 grid-rows-2 gap-2'
  : 'col-span-1 grid grid-cols-3 md:grid-cols-6 gap-2')

// 根据卡片索引和地球显示状态，返回 grid 位置 class
// 6 个卡片排列为 2 行 3 列（有地球时） 或 1 行 6 列（无地球时）
const EARTH_POSITION_CLASSES = [
  'col-span-4 row-span-1 col-start-1 row-start-1',
  'col-span-4 row-span-1 col-start-1 row-start-2',
  'col-span-4 row-span-1 col-start-5 row-start-1',
  'col-span-4 row-span-1 col-start-5 row-start-2',
  'col-span-4 row-span-1 col-start-9 row-start-1',
  'col-span-4 row-span-1 col-start-9 row-start-2',
]

function getCardPositionClass(idx: number): string {
  if (showEarth.value) {
    return EARTH_POSITION_CLASSES[idx] ?? EARTH_POSITION_CLASSES[0]!
  }
  return 'col-span-1 min-h-18 md:min-h-28'
}

onMounted(async () => {
  exchangeRateBaseCurrency.value = financeHelper.getStoredFinanceCurrency()
  excludeFreeNodes.value = financeHelper.shouldExcludeFreeNodes()

  const { rates } = await financeHelper.getDailyExchangeRates()
  exchangeRates.value = rates
})
</script>

<template>
  <div :class="wrapperClass">
    <NodeEarthGlobe v-if="showEarth" :nodes="globeNodes" class="col-span-12 col-start-1 md:col-span-6 md:col-start-7" />

    <div :class="cardGridClass">
      <template v-for="(cardType, idx) in appStore.summaryCards" :key="cardType">
        <!-- 内存用量 -->
        <CardX
          v-if="cardType === 'memory'"
          hoverable
          class="group h-full sd-summary-card rounded-lg transition-all"
          :class="getCardPositionClass(idx)"
          content-class="h-full !p-3"
        >
          <div class="flex h-full flex-col justify-between gap-1">
            <div class="flex items-start justify-between">
              <span class="sd-summary-label text-xs font-medium tracking-wider">内存用量</span>
              <img src="/images/card/icon-memory.png" alt="内存" class="sd-summary-icon">
            </div>
            <Transition v-bind="metricSwitchTransitionProps">
              <div
                :key="`memory-${summaryTransitionKey}`" class="flex items-baseline gap-1 min-w-0"
                :style="getMetricSwitchStyle(idx)"
              >
                <span class="text-md md:text-2xl font-bold leading-none tracking-tight">
                  {{ formattedMemoryUsed.value }}
                </span>
                <span class="text-[11px] md:text-xs font-medium text-muted-foreground truncate">
                  {{ formattedMemoryUsed.unit }} / {{ formattedMemoryTotal.value }} {{ formattedMemoryTotal.unit }}
                </span>
              </div>
            </Transition>
            <img src="/images/card/decor-memory.png" alt="" aria-hidden="true" class="sd-summary-decor sd-summary-decor--memory">
          </div>
        </CardX>

        <!-- 硬盘用量 -->
        <CardX
          v-else-if="cardType === 'disk'"
          hoverable
          class="group h-full sd-summary-card rounded-lg transition-all"
          :class="getCardPositionClass(idx)"
          content-class="h-full !p-3"
        >
          <div class="flex h-full flex-col justify-between gap-1">
            <div class="flex items-start justify-between">
              <span class="sd-summary-label text-xs font-medium tracking-wider">硬盘用量</span>
              <img src="/images/card/icon-disk.png" alt="硬盘" class="sd-summary-icon">
            </div>
            <Transition v-bind="metricSwitchTransitionProps">
              <div
                :key="`disk-${summaryTransitionKey}`" class="flex items-baseline gap-1 min-w-0"
                :style="getMetricSwitchStyle(idx)"
              >
                <span class="text-md md:text-2xl font-bold leading-none tracking-tight">{{ formattedDiskUsed.value
                }}</span>
                <span class="text-[11px] md:text-xs font-medium text-muted-foreground truncate">
                  {{ formattedDiskUsed.unit }} / {{ formattedDiskTotal.value }} {{ formattedDiskTotal.unit }}
                </span>
              </div>
            </Transition>
            <img src="/images/card/decor-disk.png" alt="" aria-hidden="true" class="sd-summary-decor sd-summary-decor--disk">
          </div>
        </CardX>

        <!-- 剩余价值 -->
        <div
          v-else-if="cardType === 'finance'"
          class="relative w-full h-full"
          :class="getCardPositionClass(idx)"
        >
          <CardX
            hoverable
            class="group h-full sd-summary-card rounded-lg transition-all"
            content-class="h-full !p-3" @click="openFinanceCard = !openFinanceCard"
          >
            <div class="flex h-full flex-col justify-between gap-1">
              <div class="flex items-start justify-between">
                <span class="sd-summary-label text-xs font-medium tracking-wider">剩余价值</span>
                <img src="/images/card/icon-coin.png" alt="剩余价值" class="sd-summary-icon">
              </div>
              <Transition v-bind="metricSwitchTransitionProps">
                <div
                  :key="`remaining-value-${summaryTransitionKey}`"
                  class="flex items-baseline gap-1 min-w-0"
                  :style="getMetricSwitchStyle(idx)"
                >
                  <span class="text-md md:text-2xl font-bold leading-none tracking-tight">
                    {{ formattedRemainingValue.symbol }}{{ formattedRemainingValue.value }}
                  </span>
                  <span class="block cursor-help truncate text-[11px] md:text-xs font-medium text-muted-foreground">
                    {{ formattedRemainingValue.currency }}
                  </span>
                </div>
              </Transition>
            </div>
          </CardX>
          <CardX
            hoverable
            class="absolute top-0 left-1/2 -translate-x-[50%] -translate-y-[25%] z-20 w-[260%] max-w-88 h-42 group sd-summary-card rounded-lg shadow-xl transition-all"
            :class="openFinanceCard ? 'opacity-100 scale-100  -translate-y-[5%]' : 'opacity-0 pointer-events-none scale-50'"
            content-class="h-full !p-4" @click="openFinanceCard = false"
          >
            <div class="flex h-full min-w-0 flex-col overflow-x-hidden overflow-y-auto">
              <div class="shrink-0 grid grid-cols-3 gap-1">
                <div v-for="item in financeSummaryItems" :key="item.label" class="min-w-0">
                  <div class="flex items-center text-xs font-medium text-muted-foreground">
                    {{ item.label }}
                  </div>
                  <div class="flex min-w-0 mt-1 items-baseline truncate">
                    <span class="shrink-0 text-xs mr-0.5 font-semibold leading-none text-muted-foreground">
                      {{ item.symbol }}
                    </span>
                    <span class=" text-sm md:text-lg font-bold leading-none tracking-tight">
                      {{ item.value }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="flex-1" />
              <div class="shrink-0 flex flex-col flex-1">
                <div class="flex mb-1 items-center justify-between gap-2">
                  <div class="flex items-center gap-1 text-xs font-medium tracking-wider text-muted-foreground">
                    今日汇率
                  </div>
                  <select
                    :value="exchangeRateBaseCurrency"
                    class="shrink-0 rounded-sm border border-border/70 bg-background/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus:text-foreground"
                    aria-label="切换汇率基准币种" @click.stop @change.stop="setExchangeRateBaseCurrency"
                  >
                    <option v-for="currency in financeRateCurrencies" :key="currency" :value="currency">
                      {{ currency }}
                    </option>
                  </select>
                </div>
                <div class="flex-1" />
                <div class="grid grid-cols-2 gap-y-1 gap-x-4">
                  <div
                    v-for="row in exchangeRateRows" :key="row.currency"
                    class="text-[11px] flex items-center justify-between"
                  >
                    <span class="text-muted-foreground">
                      {{ row.currency }}
                    </span>
                    <span>
                      {{ row.targetSymbol }}{{ row.rate }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardX>
        </div>

        <!-- 累计流量 -->
        <CardX
          v-else-if="cardType === 'traffic'"
          hoverable
          class="group h-full sd-summary-card rounded-lg transition-all"
          :class="getCardPositionClass(idx)"
          content-class="h-full !p-3"
        >
          <div class="flex h-full flex-col justify-between gap-1">
            <div class="flex items-start justify-between">
              <span class="sd-summary-label text-xs font-medium tracking-wider">累计流量</span>
              <img src="/images/card/icon-traffic.png" alt="累计流量" class="sd-summary-icon">
            </div>
            <DataTooltip
              as="span" placement="top"
              :content="`↑ ${formattedTrafficUp.value} ${formattedTrafficUp.unit}\n↓ ${formattedTrafficDown.value} ${formattedTrafficDown.unit}`"
              class="min-w-0" content-class="whitespace-pre px-2 py-1 left-0 -translate-x-0 leading-normal"
            >
              <Transition v-bind="metricSwitchTransitionProps">
                <div
                  :key="`traffic-${summaryTransitionKey}`" class="flex items-baseline gap-1"
                  :style="getMetricSwitchStyle(idx)"
                >
                  <span class="inline-block text-md md:text-2xl font-bold leading-none tracking-tight">
                    {{ totalTrafficTooltip.value }}
                  </span>
                  <span class="inline-block text-[11px] md:text-xs font-medium text-muted-foreground">
                    {{ totalTrafficTooltip.unit }}
                  </span>
                </div>
              </Transition>
            </DataTooltip>
          </div>
        </CardX>

        <!-- 实时上行 -->
        <CardX
          v-else-if="cardType === 'speedUp'"
          hoverable
          class="group h-full sd-summary-card rounded-lg transition-all"
          :class="getCardPositionClass(idx)"
          content-class="h-full !p-3"
        >
          <div class="flex h-full flex-col justify-between gap-1">
            <div class="flex items-start justify-between">
              <span class="sd-summary-label text-xs font-medium tracking-wider">实时上行</span>
              <img src="/images/card/icon-up.png" alt="实时上行" class="sd-summary-icon">
            </div>
            <Transition v-bind="metricSwitchTransitionProps">
              <div
                :key="`speed-up-${summaryTransitionKey}`" class="flex items-baseline gap-1"
                :style="getMetricSwitchStyle(idx)"
              >
                <span class="text-md md:text-2xl font-bold leading-none tracking-tight">{{ formattedSpeedUp.value
                }}</span>
                <span class="text-[11px] md:text-xs font-medium text-muted-foreground">{{ formattedSpeedUp.unit }}</span>
              </div>
            </Transition>
          </div>
        </CardX>

        <!-- 实时下行 -->
        <CardX
          v-else-if="cardType === 'speedDown'"
          hoverable
          class="group h-full sd-summary-card rounded-lg transition-all"
          :class="getCardPositionClass(idx)"
          content-class="h-full !p-3"
        >
          <div class="flex h-full flex-col justify-between gap-1">
            <div class="flex items-start justify-between">
              <span class="sd-summary-label text-xs font-medium tracking-wider">实时下行</span>
              <img src="/images/card/icon-down.png" alt="实时下行" class="sd-summary-icon">
            </div>
            <Transition v-bind="metricSwitchTransitionProps">
              <div
                :key="`speed-down-${summaryTransitionKey}`" class="flex items-baseline gap-1"
                :style="getMetricSwitchStyle(idx)"
              >
                <span class="text-md md:text-2xl font-bold leading-none tracking-tight">
                  {{ formattedSpeedDown.value }}
                </span>
                <span class="text-[11px] md:text-xs font-medium text-muted-foreground">{{ formattedSpeedDown.unit
                }}</span>
              </div>
            </Transition>
          </div>
        </CardX>

        <!-- 连接数 -->
        <CardX
          v-else-if="cardType === 'connections'"
          hoverable
          class="group h-full sd-summary-card rounded-lg transition-all"
          :class="getCardPositionClass(idx)"
          content-class="h-full !p-3"
        >
          <div class="flex h-full flex-col justify-between gap-1">
            <div class="flex items-start justify-between">
              <span class="sd-summary-label text-xs font-medium tracking-wider">连接数</span>
              <img src="/images/card/icon-network.png" alt="连接数" class="sd-summary-icon">
            </div>
            <DataTooltip
              as="span" placement="top"
              :content="`TCP: ${totalConnections.tcp.toLocaleString('zh-CN')}\nUDP: ${totalConnections.udp.toLocaleString('zh-CN')}`"
              class="min-w-0" content-class="whitespace-pre px-2 py-1 left-0 -translate-x-0 leading-normal"
            >
              <Transition v-bind="metricSwitchTransitionProps">
                <div
                  :key="`connections-${summaryTransitionKey}`" class="flex items-baseline gap-1"
                  :style="getMetricSwitchStyle(idx)"
                >
                  <span class="text-md md:text-2xl font-bold leading-none tracking-tight">
                    {{ formatNumber(totalConnections.total) }}
                  </span>
                  <span class="text-[11px] md:text-xs font-medium text-muted-foreground">TCP+UDP</span>
                </div>
              </Transition>
            </DataTooltip>
          </div>
        </CardX>
      </template>
    </div>
  </div>
</template>

<style scoped>
.metric-switch-enter-active,
.metric-switch-leave-active {
  transition:
    opacity 160ms ease,
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 180ms ease;
}

.metric-switch-enter-active {
  transition-delay: var(--metric-switch-delay, 0ms);
}

.metric-switch-enter-from {
  opacity: 0;
  transform: translateY(6px);
  filter: blur(3px);
}

.metric-switch-leave-to {
  opacity: 0;
  transform: translateY(-4px);
  filter: blur(2px);
}

@media (prefers-reduced-motion: reduce) {
  .metric-switch-enter-active,
  .metric-switch-leave-active {
    transition: none;
    transition-delay: 0ms;
  }

  .metric-switch-enter-from,
  .metric-switch-leave-to {
    opacity: 1;
    transform: none;
    filter: none;
  }
}

/* 概览卡像素图标（对齐星露谷素材） */
.sd-summary-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
  image-rendering: pixelated;
  pointer-events: none;
  flex-shrink: 0;
  filter: drop-shadow(1px 1px 0 rgba(62, 39, 35, 0.25));
}

/* 概览卡底部像素装饰（盆栽/植物/浇水壶等） */
.sd-summary-decor {
  align-self: center;
  flex-shrink: 0;
  height: 26px;
  width: auto;
  max-width: 30px;
  object-fit: contain;
  image-rendering: pixelated;
  pointer-events: none;
  opacity: 0.9;
  margin-top: 1px;
  filter: drop-shadow(1px 2px 0 rgba(62, 39, 35, 0.2));
}
.sd-summary-decor--disk {
  height: 22px;
}

/* ===== 统一概览卡为星露谷羊皮纸像素风格(官方木框素材) ===== */
.sd-summary-card {
  border: 18px solid transparent !important;
  border-image: url('/images/card/frame-slice.png') 64 round;
  background: rgba(250, 243, 220, 0.35) !important;
  border-radius: 0 !important;
}
.sd-summary-card:hover {
  transform: translate(-1px, -1px);
}
.sd-summary-card .sd-summary-label {
  color: #3d2b1f;
  font-weight: 600;
  letter-spacing: 0.03em;
}
.sd-summary-card .sd-summary-value {
  color: #3d2b1f;
}
</style>
