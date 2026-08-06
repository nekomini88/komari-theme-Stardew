<script setup lang="ts">
import type { CurrencyCode } from '@/utils/financeHelper'
import { Icon } from '@iconify/vue'
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardX } from '@/components/ui/card-x'
import { Empty } from '@/components/ui/empty'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import * as financeHelper from '@/utils/financeHelper'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, formatUptimeWithFormat } from '@/utils/helper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { getBillingCycleText, getExpireStatus, getExpireText } from '@/utils/tagHelper'

const LoadChart = defineAsyncComponent(() => import('@/components/LoadChart.vue'))
const PingChart = defineAsyncComponent(() => import('@/components/PingChart.vue'))

const route = useRoute()
const router = useRouter()

const appStore = useAppStore()
const nodesStore = useNodesStore()
const exchangeRates = ref(financeHelper.DEFAULT_EXCHANGE_RATES)
const financeBaseCurrency = ref<CurrencyCode>('CNY')

onMounted(async () => {
  window.scrollTo({ top: 0, behavior: 'instant' })
  financeBaseCurrency.value = financeHelper.getStoredFinanceCurrency()

  const { rates } = await financeHelper.getDailyExchangeRates()
  exchangeRates.value = rates
})

const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, appStore.byteDecimals)
const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, appStore.byteDecimals)
const formatUptime = (seconds: number) => formatUptimeWithFormat(seconds, 'minute')

const data = computed(() => nodesStore.nodes.find(node => node.uuid === route.params.id))

interface InfoItem {
  label: string
  value: string | undefined
  icon?: string
}

interface MetricCard {
  label: string
  value: string
  unit?: string
  icon: string
  valueClass?: string
}

const EXPIRES_IN_SUFFIX_REGEX = /^(\d+)\s*(天|days?)$/i
const CURRENCY_SUFFIX_REGEX = /^(\S.*\S)\s+([A-Z]{3})$/

function formatFinanceMetricValue(amountCNY: number, currency: CurrencyCode): string {
  const targetRate = exchangeRates.value[currency] || 1
  const formattedValue = financeHelper.formatFinanceAmount(amountCNY * targetRate, currency)
  return `${formattedValue.symbol}${formattedValue.value} ${formattedValue.currency}`
}

function splitMetricValue(value: string): { value: string, unit?: string } {
  const cycleIndex = value.indexOf(' / ')
  if (cycleIndex > -1) {
    return {
      value: value.slice(0, cycleIndex),
      unit: value.slice(cycleIndex),
    }
  }

  const expiresInMatch = value.match(EXPIRES_IN_SUFFIX_REGEX)
  if (expiresInMatch) {
    return {
      value: expiresInMatch[1] ?? value,
      unit: expiresInMatch[2] ?? undefined,
    }
  }

  const currencyMatch = value.match(CURRENCY_SUFFIX_REGEX)
  if (currencyMatch) {
    return {
      value: currencyMatch[1] ?? value,
      unit: currencyMatch[2] ?? undefined,
    }
  }

  return { value }
}

const nodePriceText = computed(() => {
  if (!data.value)
    return '-'

  const priceCNY = financeHelper.calculateValueCNY(data.value, exchangeRates.value)
  if (priceCNY <= 0)
    return formatFinanceMetricValue(0, financeBaseCurrency.value)

  return `${formatFinanceMetricValue(priceCNY, financeBaseCurrency.value)} / ${getBillingCycleText(data.value.billing_cycle, appStore.lang)}`
})

const monthlyAverageCostText = computed(() => {
  if (!data.value)
    return '-'

  if (Number(data.value.billing_cycle) <= 0)
    return appStore.lang === 'zh-CN' ? '不适用' : 'N/A'

  const monthlyAverageCost = financeHelper.calculateMonthlyAverageCostCNY(data.value, exchangeRates.value)
  return `${formatFinanceMetricValue(monthlyAverageCost, financeBaseCurrency.value)} / 月`
})

const remainingTimeText = computed(() => {
  if (!data.value?.expired_at)
    return '-'

  return getExpireText(data.value.expired_at, appStore.lang)
})

const remainingValueText = computed(() => {
  if (!data.value)
    return '-'

  const remainingValueCNY = financeHelper.calculateRemainingValueCNY(data.value, exchangeRates.value)
  return formatFinanceMetricValue(remainingValueCNY, financeBaseCurrency.value)
})

const remainingTimeValueClass = computed(() => {
  if (!data.value?.expired_at)
    return ''

  const status = getExpireStatus(data.value.expired_at)
  if (status === 'expired' || status === 'critical')
    return 'text-destructive'
  if (status === 'warning')
    return 'text-orange-600 dark:text-orange-400'
  if (status === 'long_term')
    return 'text-muted-foreground'
  return 'text-emerald-600 dark:text-emerald-400'
})

const metricCards = computed<MetricCard[]>(() => {
  if (!data.value)
    return []

  const nodePrice = splitMetricValue(nodePriceText.value)
  const monthlyAverageCost = splitMetricValue(monthlyAverageCostText.value)
  const remainingTime = splitMetricValue(remainingTimeText.value)
  const remainingValue = splitMetricValue(remainingValueText.value)

  return [
    {
      label: '节点价格',
      value: nodePrice.value,
      unit: nodePrice.unit,
      icon: 'tabler:cash',
    },
    {
      label: '月均支出',
      value: monthlyAverageCost.value,
      unit: monthlyAverageCost.unit,
      icon: 'tabler:receipt-2',
    },
    {
      label: '剩余时间',
      value: remainingTime.value,
      unit: remainingTime.unit,
      icon: 'tabler:calendar-dollar',
      valueClass: remainingTimeValueClass.value,
    },
    {
      label: '剩余价值',
      value: remainingValue.value,
      unit: remainingValue.unit,
      icon: 'tabler:coins',
    },
  ]
})

const hardwareInfo = computed<InfoItem[]>(() => [
  { label: 'CPU', value: data.value ? `${data.value.cpu_name} (x${data.value.cpu_cores})` : '-', icon: 'icon-park-outline:cpu' },
  { label: '架构', value: data.value?.arch ?? '-', icon: 'icon-park-outline:application-two' },
  { label: '虚拟化', value: data.value?.virtualization ?? '-', icon: 'icon-park-outline:server' },
  { label: 'GPU', value: data.value?.gpu_name || '-', icon: 'icon-park-outline:video-one' },
])

const systemInfo = computed<InfoItem[]>(() => [
  { label: '操作系统', value: data.value?.os ?? '-', icon: 'icon-park-outline:computer' },
  { label: '内核版本', value: data.value?.kernel_version ?? '-', icon: 'icon-park-outline:code' },
  { label: '运行时间', value: formatUptime(data.value?.uptime ?? 0), icon: 'icon-park-outline:timer' },
  { label: '最后上报', value: formatDateTime(data.value?.time), icon: 'icon-park-outline:time' },
])

const storageInfo = computed<InfoItem[]>(() => [
  { label: '内存', value: formatBytes(data.value?.mem_total ?? 0), icon: 'icon-park-outline:memory' },
  { label: '内存交换', value: formatBytes(data.value?.swap_total ?? 0), icon: 'icon-park-outline:switch' },
  { label: '硬盘', value: formatBytes(data.value?.disk_total ?? 0), icon: 'icon-park-outline:hard-disk' },
])

const trafficUsed = computed(() => {
  const node = data.value
  if (!node)
    return 0

  const { net_total_up = 0, net_total_down = 0, traffic_limit_type } = node
  switch (traffic_limit_type) {
    case 'up':
      return net_total_up
    case 'down':
      return net_total_down
    case 'min':
      return Math.min(net_total_up, net_total_down)
    case 'max':
      return Math.max(net_total_up, net_total_down)
    case 'sum':
    default:
      return net_total_up + net_total_down
  }
})

const hasTrafficLimit = computed(() => (data.value?.traffic_limit ?? 0) > 0)

const trafficUsedPercentage = computed(() => {
  const trafficLimit = data.value?.traffic_limit ?? 0
  if (trafficLimit <= 0)
    return 0

  return Math.min((trafficUsed.value / trafficLimit) * 100, 100)
})

const trafficUsageText = computed(() => {
  if (!hasTrafficLimit.value)
    return '无限流量'

  return `${formatBytes(trafficUsed.value)} / ${formatBytes(data.value?.traffic_limit ?? 0)}`
})

const trafficProgressStyle = computed(() => ({
  width: `${trafficUsedPercentage.value}%`,
}))

// ==================== 星露谷风格 MEMORY/CPU/DISK/LOAD 实时四卡 ====================
const sdMemPct = computed(() => {
  const n = data.value
  if (!n) return 0
  return (n.ram ?? 0) / (n.mem_total || 1) * 100
})
const sdCpuPct = computed(() => Math.max(0, Math.min(data.value?.cpu ?? 0, 100)))
const sdDiskPct = computed(() => {
  const n = data.value
  if (!n) return 0
  return (n.disk ?? 0) / (n.disk_total || 1) * 100
})
const sdLoadVal = computed(() => data.value?.load ?? 0)
const sdLoadPct = computed(() => {
  const cores = Math.max(data.value?.cpu_cores ?? 1, 1)
  return Math.min(((data.value?.load ?? 0) / cores) * 100, 100)
})

const sdResourceCards = computed(() => {
  const n = data.value
  if (!n) return []
  return [
    { key: 'memory', title: 'MEMORY', icon: '/images/card/icon-memory.png', decor: '/images/card/decor-memory.png', pct: sdMemPct.value, text: `${sdMemPct.value.toFixed(1)}%`, color: '#66bb6a' },
    { key: 'cpu', title: 'CPU', icon: '/images/card/icon-cpu.png', decor: '/images/card/decor-cpu.png', pct: sdCpuPct.value, text: `${sdCpuPct.value.toFixed(0)}%`, color: '#42a5f5' },
    { key: 'disk', title: 'DISK', icon: '/images/card/icon-disk.png', decor: '/images/card/decor-disk.png', pct: sdDiskPct.value, text: `${sdDiskPct.value.toFixed(1)}%`, color: '#ef5350' },
    { key: 'load', title: 'LOAD', icon: '/images/card/icon-load.png', decor: '/images/card/decor-load.png', pct: sdLoadPct.value, text: sdLoadVal.value.toFixed(2), color: '#ffb74d' },
  ]
})

const sdProgressProps = (percent: number, color: string) => ({ percent, color })
</script>

<template>
  <div class="instance-detail space-y-4">
    <div v-if="!data" class="p-4">
      <CardX>
        <Empty description="节点不存在或已被删除">
          <template #extra>
            <Button @click="router.push('/')">
              返回首页
            </Button>
          </template>
        </Empty>
      </CardX>
    </div>

    <template v-else>
      <div class="px-4 flex gap-4 items-center">
        <Button variant="ghost" size="icon-sm" class="bg-background/50 hover:bg-background" @click="router.push('/')">
          <Icon icon="tabler:arrow-left" :width="16" :height="16" />
        </Button>
        <div class="text-lg font-bold flex gap-2 items-center">
          <img
            :src="`/images/flags/${getRegionCode(data.region)}.svg`" :alt="getRegionDisplayName(data.region)"
            class="size-6"
          >
          <span>{{ data.name }}</span>
        </div>
        <Badge :variant="data.online ? 'default' : 'destructive'" class="text-xs !rounded">
          {{ data.online ? '在线' : '离线' }}
        </Badge>
      </div>

      <div class="px-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div
          v-for="card in sdResourceCards" :key="card.key"
          class="sd-resource-card group relative flex h-full flex-col rounded-lg p-3 ring-1 ring-[#3e2723]/20"
        >
          <!-- 顶部图标 -->
          <div class="flex items-center justify-between">
            <span class="sd-resource-title">{{ card.title }}</span>
            <img :src="card.icon" :alt="card.title" class="sd-resource-icon">
          </div>
          <!-- 主数值 -->
          <div class="mt-2 flex items-baseline gap-1 min-w-0">
            <span class="sd-resource-value" :style="{ color: card.color }">{{ card.text }}</span>
          </div>
          <!-- 像素进度条 -->
          <div class="mt-2">
            <PixelProgress :percentage="card.pct" :color="card.color" :blocks="10" :size="10" />
          </div>
          <!-- 底部装饰 -->
          <img :src="card.decor" alt="" aria-hidden="true" class="sd-resource-decor">
        </div>
      </div>

      <div class="px-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CardX
          v-for="item in metricCards" :key="item.label" hoverable size="small"
          class="group h-full backdrop-blur-xl backdrop-saturate-150 bg-background/40 border-none hover:bg-background/60 transition-all rounded-lg ring-1 ring-foreground/[0.06] shadow-sm glass-hover-blur"
          content-class="h-full !p-3"
        >
          <div class="flex h-full min-h-10 md:min-h-18 flex-col justify-between gap-3">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-medium tracking-wider text-muted-foreground">{{ item.label }}</span>
              <Icon
                :icon="item.icon" :width="20" :height="20"
                class="text-slate-500/25 transition-colors group-hover:text-slate-500"
              />
            </div>
            <div class="min-w-0 space-y-1">
              <div
                class="flex min-w-0 items-baseline gap-1 truncate font-semibold leading-none"
                :class="item.valueClass"
              >
                <span class="truncate text-base sm:text-2xl">{{ item.value }}</span>
                <span v-if="item.unit" class="shrink-0 text-[11px] font-medium text-muted-foreground sm:text-xs">
                  {{ item.unit }}
                </span>
              </div>
            </div>
          </div>
        </CardX>
      </div>

      <div class="px-4 gap-4 grid grid-cols-1 lg:grid-cols-2">
        <CardX
          title="硬件信息" size="small"
          class="group h-full backdrop-blur-xl backdrop-saturate-150 bg-background/40 border-none hover:bg-background/60 transition-all rounded-lg ring-1 ring-foreground/[0.06] shadow-sm glass-hover-blur"
        >
          <div class="gap-3 grid grid-cols-3">
            <div
              v-for="(item, index) in hardwareInfo" :key="item.label"
              class="min-w-0 flex flex-col gap-1 rounded-sm bg-slate-500/5 p-2" :class="!index && 'col-span-3'"
            >
              <div class="flex gap-1 items-center text-muted-foreground">
                <Icon v-if="item.icon" :icon="item.icon" :width="14" :height="14" />
                <span class="text-xs sm:text-sm">{{ item.label }}</span>
              </div>
              <span class="text-xs sm:text-sm break-all">{{ item.value }}</span>
            </div>
          </div>
        </CardX>

        <CardX
          title="系统信息" size="small"
          class="group h-full backdrop-blur-xl backdrop-saturate-150 bg-background/40 border-none hover:bg-background/60 transition-all rounded-lg ring-1 ring-foreground/[0.06] shadow-sm glass-hover-blur"
        >
          <div class="gap-3 grid grid-cols-1 sm:grid-cols-2">
            <div
              v-for="item in systemInfo" :key="item.label"
              class="min-w-0 flex flex-col gap-1 rounded-sm bg-slate-500/5 p-2"
            >
              <div class="flex gap-1 items-center text-muted-foreground">
                <Icon v-if="item.icon" :icon="item.icon" :width="14" :height="14" />
                <span class="text-xs sm:text-sm">{{ item.label }}</span>
              </div>
              <div class="flex min-w-0 gap-2 items-center">
                <img
                  v-if="item.label === '操作系统'" :src="getOSImage(data.os)" :alt="getOSName(data.os)"
                  class="size-5 shrink-0"
                >
                <span class="text-xs sm:text-sm break-all">
                  {{ item.value }}
                </span>
              </div>
            </div>
          </div>
        </CardX>

        <CardX
          title="存储信息" size="small"
          class="group h-full backdrop-blur-xl backdrop-saturate-150 bg-background/40 border-none hover:bg-background/60 transition-all rounded-lg ring-1 ring-foreground/[0.06] shadow-sm glass-hover-blur"
        >
          <div class="gap-3 grid grid-cols-3">
            <div
              v-for="item in storageInfo" :key="item.label"
              class="min-w-0 flex flex-col gap-1 rounded-sm bg-slate-500/5 p-2"
            >
              <div class="flex gap-1 items-center text-muted-foreground">
                <Icon v-if="item.icon" :icon="item.icon" :width="14" :height="14" />
                <span class="text-xs sm:text-sm">{{ item.label }}</span>
              </div>
              <span class="text-xs sm:text-sm break-all">{{ item.value }}</span>
            </div>
          </div>
        </CardX>

        <CardX
          title="网络信息" size="small"
          class="group h-full backdrop-blur-xl backdrop-saturate-150 bg-background/40 border-none hover:bg-background/60 transition-all rounded-lg ring-1 ring-foreground/[0.06] shadow-sm glass-hover-blur"
          content-class="pt-0"
        >
          <div class="gap-3 grid grid-cols-2">
            <div class="relative min-w-0 overflow-hidden rounded-sm bg-slate-500/5 p-2">
              <div
                v-if="hasTrafficLimit"
                class="absolute inset-y-0 left-0 rounded-sm bg-primary/10 pointer-events-none transition-[width] duration-300 ease-out"
                :style="trafficProgressStyle"
              />
              <div class="relative flex flex-col gap-1.5">
                <div class="flex gap-1 items-center text-muted-foreground">
                  <Icon icon="icon-park-outline:transfer-data" :width="14" :height="14" />
                  <span class="text-xs sm:text-sm">总流量</span>
                  <div class="flex-1" />
                  <span class="hidden sm:block text-[11px] font-medium text-foreground/70">{{
                    formatBytes(data?.net_total_up ?? 0) }} / {{ formatBytes(data?.net_total_down ?? 0) }}</span>
                </div>
                <span class="text-xs sm:text-sm break-all">
                  {{ trafficUsageText }}
                </span>
              </div>
            </div>
            <div class="min-w-0 flex flex-col gap-1 rounded-sm bg-slate-500/5 p-2">
              <div class="flex gap-1 items-center text-muted-foreground">
                <Icon icon="icon-park-outline:dashboard-one" :width="14" :height="14" />
                <span class="text-xs sm:text-sm">网络速率</span>
              </div>
              <span class="text-xs sm:text-sm break-all flex flex-row flex-wrap items-center gap-1">
                <Icon icon="tabler:chevron-up" width="12" height="12" />
                {{ formatBytesPerSecond(data?.net_out ?? 0) }}
                <span class="px-0.5" />
                <Icon icon="tabler:chevron-down" width="12" height="12" />
                {{ formatBytesPerSecond(data?.net_in ?? 0) }}
              </span>
            </div>
          </div>
        </CardX>
      </div>

      <LoadChart :uuid="data.uuid" class="px-4" />
      <PingChart :uuid="data.uuid" class="px-4" />
    </template>
  </div>
</template>

<style scoped>
/* 星露谷风格资源四卡（MEMORY/CPU/DISK/LOAD） */
.sd-resource-card {
  background:
    linear-gradient(rgba(245, 230, 200, 0.55), rgba(245, 230, 200, 0.45)),
    #f5e6c8;
  box-shadow:
    3px 3px 0 rgba(62, 39, 35, 0.16),
    inset 0 0 0 3px #fbf3e3,
    inset 0 0 0 4px rgba(62, 39, 35, 0.9);
}
.sd-resource-card:hover {
  transform: translate(-1px, -1px);
  box-shadow:
    4px 4px 0 rgba(62, 39, 35, 0.22),
    inset 0 0 0 3px #fbf3e3,
    inset 0 0 0 4px rgba(62, 39, 35, 0.9);
}
.sd-resource-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #3d2b1f;
}
.sd-resource-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
  image-rendering: pixelated;
  pointer-events: none;
  filter: drop-shadow(1px 1px 0 rgba(62, 39, 35, 0.25));
}
.sd-resource-value {
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
}
.sd-resource-decor {
  position: absolute;
  right: 6px;
  bottom: 6px;
  height: 22px;
  width: auto;
  max-width: 26px;
  object-fit: contain;
  image-rendering: pixelated;
  pointer-events: none;
  opacity: 0.92;
  filter: drop-shadow(1px 2px 0 rgba(62, 39, 35, 0.2));
}
</style>
