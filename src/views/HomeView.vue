<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useDebounceFn } from '@vueuse/core'
import { computed, defineAsyncComponent, nextTick, onActivated, onDeactivated, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { getCountryCodeFromRegion } from '@/utils/geoHelper'
import { isNodeInGroup, parseNodeGroups } from '@/utils/groupHelper'
import { getRegionDisplayName, isRegionMatch } from '@/utils/regionHelper'

defineOptions({ name: 'HomeView' })

const NodeCard = defineAsyncComponent(() => import('@/components/NodeCard.vue'))
const NodeGeneralCards = defineAsyncComponent(() => import('@/components/NodeGeneralCards.vue'))
const NodeList = defineAsyncComponent(() => import('@/components/NodeList.vue'))
const VisitorInfoCard = defineAsyncComponent(() => import('@/components/VisitorInfoCard.vue'))
const TopStatsGrid = defineAsyncComponent(() => import('@/components/TopStatsGrid.vue'))

const nodeItemStaggerMs = 35
const nodeItemStaggerLimit = 12

const appStore = useAppStore()
const nodesStore = useNodesStore()
const router = useRouter()

onActivated(() => {
  if (appStore.homeScrollPosition > 0) {
    nextTick(() => {
      window.scrollTo({ top: appStore.homeScrollPosition, behavior: 'instant' })
    })
  }
})

onDeactivated(() => {
  appStore.homeScrollPosition = window.scrollY
})

const searchText = ref('')
const debouncedSearchText = ref('')

const updateDebouncedSearch = useDebounceFn((value: string) => {
  debouncedSearchText.value = value
}, 300)

watch(searchText, (value) => {
  updateDebouncedSearch(value)
})

const groups = computed(() => [
  { tab: '全部节点', name: 'all' },
  ...nodesStore.groups.map(g => ({ tab: g, name: g })),
])

const regionGroups = computed(() => {
  const regionMap = new Map<string, { emoji: string, name: string, count: number }>()
  for (const node of nodesStore.nodes) {
    const code = getCountryCodeFromRegion(node.region)
    if (!code)
      continue
    const emoji = node.region.trim()
    if (!regionMap.has(code)) {
      regionMap.set(code, { emoji, name: getRegionDisplayName(emoji), count: 0 })
    }
    regionMap.get(code)!.count++
  }
  return Array.from(regionMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([code, info]) => ({
      tab: info.name,
      name: `region:${code}`,
      code,
      emoji: info.emoji,
      label: info.name,
      plain: info.name,
    }))
})

const allTabs = computed(() => [
  ...groups.value,
  ...regionGroups.value,
] as Array<{ tab: string, name: string, code?: string, emoji?: string, label?: string, plain?: string }>)

watch(
  () => [nodesStore.groups, regionGroups.value] as const,
  ([gs]) => {
    const cur = appStore.nodeSelectedGroup
    if (cur === 'all')
      return
    if (cur.startsWith('region:')) {
      if (!regionGroups.value.some(r => r.name === cur)) {
        appStore.nodeSelectedGroup = 'all'
      }
      return
    }
    if (!gs.includes(cur)) {
      appStore.nodeSelectedGroup = 'all'
    }
  },
  { immediate: true },
)

function isNodeMatchSearch(node: typeof nodesStore.nodes[number], search: string): boolean {
  if (!search.trim())
    return true
  const lowerSearch = search.toLowerCase().trim()
  if (node.name.toLowerCase().includes(lowerSearch))
    return true
  if (node.region && isRegionMatch(node.region, search))
    return true
  if (node.os && node.os.toLowerCase().includes(lowerSearch))
    return true
  if (parseNodeGroups(node.group).some(group => group.toLowerCase().includes(lowerSearch)))
    return true
  if (node.tags && node.tags.toLowerCase().includes(lowerSearch))
    return true
  if (node.remark && node.remark.toLowerCase().includes(lowerSearch))
    return true
  return false
}

const groupNodeList = computed(() => {
  const selected = appStore.nodeSelectedGroup
  if (selected.startsWith('region:')) {
    const code = selected.slice(7)
    return nodesStore.nodes.filter(node => getCountryCodeFromRegion(node.region) === code)
  }
  return nodesStore.nodes.filter(node => isNodeInGroup(node.group, selected))
})

const nodeList = computed(() => {
  let filtered = groupNodeList.value
  if (debouncedSearchText.value.trim()) {
    filtered = filtered.filter(n => isNodeMatchSearch(n, debouncedSearchText.value))
  }
  return filtered
})

function handleNodeClick(node: typeof nodesStore.nodes[number]) {
  router.push({ name: 'instance-detail', params: { id: node.uuid } })
}

function getNodeItemTransitionKey(node: typeof nodesStore.nodes[number]): string {
  return `${appStore.nodeSelectedGroup}-${node.uuid}`
}

function getNodeItemTransitionStyle(index: number): Record<string, string> {
  return {
    '--node-item-delay': `${Math.min(index, nodeItemStaggerLimit) * nodeItemStaggerMs}ms`,
  }
}
</script>

<template>
  <div class="home-view">
    <div v-if="appStore.connectionError" class="alert px-4">
      <Alert variant="destructive" class="border-none backdrop-blur-xl backdrop-saturate-150 bg-red-400/10 rounded-lg ring-1 ring-red-500/[0.1]">
        <AlertTitle>RPC 服务错误</AlertTitle>
        <AlertDescription>连接服务器失败，请检查网络设置或刷新页面后再试。</AlertDescription>
      </Alert>
    </div>

    <div v-if="appStore.alertEnabled && appStore.alertContent" class="alert px-4">
      <Alert class="border-none backdrop-blur-xl backdrop-saturate-150 bg-background/40 rounded-lg ring-1 ring-foreground/[0.06] shadow-sm">
        <AlertTitle v-if="appStore.alertTitle">
          {{ appStore.alertTitle }}
        </AlertTitle>
        <AlertDescription>
          <MarkdownRenderer :content="appStore.alertContent" />
        </AlertDescription>
      </Alert>
    </div>

    <NodeGeneralCards
      v-if="!appStore.hideGeneralCard"
      :nodes="groupNodeList"
      :globe-nodes="groupNodeList"
      :transition-key="appStore.nodeSelectedGroup"
      class="hidden"
    />

    <div class="stardew-content">
      <TopStatsGrid />

      <VisitorInfoCard v-if="appStore.visitorInfoCardEnabled" />

      <div class="node-info p-4 pt-0 flex flex-col gap-4 relative z-1 pointer-events-none" :class="!!appStore.hideGeneralCard && 'pt-4'">
        <div class="nodes">
          <Tabs v-model="appStore.nodeSelectedGroup" class="w-full flex-col gap-4">
            <div class="flex gap-2 items-center flex-nowrap">
              <div class="min-w-0 flex-1 overflow-x-auto rounded-sm pointer-events-none">
                <TabsList class="w-max h-8 backdrop-blur-xl backdrop-saturate-150 bg-background/40 rounded-lg ring-1 ring-foreground/[0.06] shadow-sm pointer-events-auto">
                  <TabsTrigger
                    v-for="g in allTabs" :key="g.name" :value="g.name"
                    class="h-6.5 flex-none shrink-0 text-xs border-none data-[state=active]:text-green-600 shadow-none rounded-sm"
                  >
                    <span class="tab-label">
                      <span v-if="g.code" class="flag-icon">
                        <img :src="'/images/flags/' + g.code + '.svg'" :alt="g.tab" class="flag-img">
                      </span>
                      <span class="flag-text">{{ g.plain ?? g.tab }}</span>
                    </span>
                  </TabsTrigger>
                </TabsList>
              </div>
              <div class="search flex gap-2 items-center pointer-events-auto">
                <Button
                  variant="outline" size="icon" aria-label="卡片视图"
                  class="w-8 h-8 border-none backdrop-blur-xl backdrop-saturate-150 bg-background/40 shadow-none hover:bg-background/60 rounded-lg ring-1 ring-foreground/[0.06]"
                  :class="[appStore.nodeViewMode === 'card' ? '!text-green-600 !bg-background' : '']"
                  @click="appStore.nodeViewMode = 'card'"
                >
                  <Icon icon="tabler:layout-grid" :width="14" :height="14" />
                </Button>
                <Button
                  variant="outline" size="icon" aria-label="列表视图"
                  class="w-8 h-8 border-none backdrop-blur-xl backdrop-saturate-150 bg-background/40 shadow-none hover:bg-background/60 rounded-lg ring-1 ring-foreground/[0.06]"
                  :class="[appStore.nodeViewMode === 'list' ? '!text-green-600 !bg-background' : '']"
                  @click="appStore.nodeViewMode = 'list'"
                >
                  <Icon icon="tabler:table" :width="14" :height="14" />
                </Button>
                <div class="relative z-1 w-8 h-8">
                  <div class="absolute top-0 right-0">
                    <Input
                      v-model="searchText" placeholder="搜索节点名称、地区、系统"
                      class="transition-all placeholder:text-transparent border-none shadow-none w-8 h-8 backdrop-blur-xl backdrop-saturate-150 bg-background/40 rounded-lg ring-1 ring-foreground/[0.06] hover:!bg-background/60 focus:!w-60 focus:!pl-7.5 focus:placeholder:!text-muted-foreground focus:!bg-background/60 focus:!ring-foreground/[0.1]"
                    />
                    <Icon
                      icon="tabler:search" :width="14" :height="14"
                      class="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                  </div>
                </div>
              </div>
            </div>
            <TabsContent v-for="g in allTabs" :key="g.name" :value="g.name" class="pointer-events-auto">
              <TransitionGroup
                v-if="nodeList.length !== 0 && appStore.nodeViewMode === 'card'"
                :appear="!appStore.disablePageAnimation"
                :css="!appStore.disablePageAnimation"
                name="node-card-switch"
                tag="div"
                class="gap-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 pt-2"
              >
                <div
                  v-for="(node, index) in nodeList"
                  :key="getNodeItemTransitionKey(node)"
                  class="min-w-0 overflow-visible"
                  :style="getNodeItemTransitionStyle(index)"
                >
                  <NodeCard :node="node" @click="handleNodeClick(node)" />
                </div>
              </TransitionGroup>
              <NodeList
                v-else-if="nodeList.length !== 0 && appStore.nodeViewMode === 'list'"
                :nodes="nodeList"
                :transition-key="appStore.nodeSelectedGroup"
                @click="handleNodeClick"
              />
              <div v-else class="text-muted-foreground text-center py-8">
                <Empty description="暂无节点" />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.node-card-switch-enter-active,
.node-card-switch-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.home-view {
  position: relative;
}

.node-card-switch-enter-active {
  transition-delay: var(--node-item-delay, 0ms);
}

.node-card-switch-move {
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.node-card-switch-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.985);
  filter: blur(3px);
}

.node-card-switch-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.99);
  filter: blur(2px);
}

@media (prefers-reduced-motion: reduce) {
  .node-card-switch-enter-active,
  .node-card-switch-leave-active,
  .node-card-switch-move {
    transition: none;
    transition-delay: 0ms;
  }

  .node-card-switch-enter-from,
  .node-card-switch-leave-to {
    opacity: 1;
    transform: none;
    filter: none;
  }
}

.tab-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  line-height: 1;
  white-space: nowrap;
  vertical-align: middle;
}

.tab-label .flag-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 12px;
  border-radius: 2px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
  line-height: 0;
  flex-shrink: 0;
  vertical-align: middle;
}

.tab-label .flag-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  image-rendering: auto;
}

.tab-label .flag-emoji {
  font-size: 0.85em;
  line-height: 1;
  filter: drop-shadow(0 1px 0 rgba(0,0,0,0.1));
  flex-shrink: 0;
  vertical-align: middle;
}

.tab-label .flag-text {
  line-height: 1;
  text-align: center;
  vertical-align: middle;
}
</style>
