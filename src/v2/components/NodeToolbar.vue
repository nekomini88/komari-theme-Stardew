<script setup lang="ts">
/**
 * NodeToolbar —— 首页搜索 / 排序 / 分组 / 状态筛选控件（像素风）
 *
 * 控件本身只负责收集用户输入并 emit，不做任何筛选/排序计算：
 * 计算全部交给 @/v2/data/nodeModel 的纯函数（searchNodes / filterNodes / sortNodes），
 * 由 HomeView 统一装配，避免出现第二套逻辑。
 *
 * 状态筛选「颜色 + 文字」双重表达（STATUS_FILTER_LABELS），不靠颜色单独表意。
 */
import type { SortDir, SortKey } from '@/v2/data/types'
import type { StatusFilter } from '@/v2/data/nodeModel'
import { computed } from 'vue'
import { STATUS_FILTER_LABELS } from '@/v2/data/nodeModel'

const props = withDefaults(defineProps<{
  query: string
  sortKey: SortKey
  sortDir: SortDir
  group: string
  status: StatusFilter
  groups: readonly string[]
  /** 过滤后可见节点数 / 总节点数（用于结果提示） */
  visibleCount?: number
  totalCount?: number
}>(), {
  visibleCount: 0,
  totalCount: 0,
})

const emit = defineEmits<{
  'update:query': [string]
  'update:sortKey': [SortKey]
  'update:sortDir': [SortDir]
  'update:group': [string]
  'update:status': [StatusFilter]
}>()

/** 排序项（键 → 中文文案） */
const SORT_OPTIONS: { key: SortKey, label: string }[] = [
  { key: 'default', label: '默认' },
  { key: 'name', label: '名称' },
  { key: 'cpu', label: 'CPU' },
  { key: 'ram', label: '内存' },
  { key: 'disk', label: '硬盘' },
  { key: 'traffic', label: '流量' },
  { key: 'load', label: '负载' },
  { key: 'latency', label: '延迟' },
]

const STATUS_OPTIONS: StatusFilter[] = ['all', 'online', 'offline', 'unknown']

/** 排序方向无意义时（默认排序）隐藏切换按钮 */
const dirDisabled = computed(() => props.sortKey === 'default')
const dirLabel = computed(() => (props.sortDir === 'asc' ? '升序 ↑' : '降序 ↓'))

function onQuery(e: Event) {
  emit('update:query', (e.target as HTMLInputElement).value)
}
function onSort(e: Event) {
  emit('update:sortKey', (e.target as HTMLSelectElement).value as SortKey)
}
function onGroup(e: Event) {
  emit('update:group', (e.target as HTMLSelectElement).value)
}
function onStatus(s: StatusFilter) {
  emit('update:status', s)
}
function toggleDir() {
  emit('update:sortDir', props.sortDir === 'asc' ? 'desc' : 'asc')
}
</script>

<template>
  <section class="vk-toolbar" data-testid="node-toolbar" aria-label="节点筛选与排序">
    <label class="vk-field vk-field-search">
      <span class="vk-field-label">搜索</span>
      <input
        class="vk-input"
        type="search"
        data-testid="node-search"
        placeholder="名称 / 分组 / 地区 / 系统"
        :value="query"
        @input="onQuery"
      >
    </label>

    <label class="vk-field">
      <span class="vk-field-label">排序</span>
      <select class="vk-select" data-testid="node-sort" :value="sortKey" @change="onSort">
        <option v-for="opt in SORT_OPTIONS" :key="opt.key" :value="opt.key">
          {{ opt.label }}
        </option>
      </select>
    </label>

    <button
      class="vk-btn vk-dir-btn"
      type="button"
      data-testid="node-sort-dir"
      :disabled="dirDisabled"
      :title="dirDisabled ? '默认排序不支持方向' : dirLabel"
      @click="toggleDir"
    >
      {{ dirLabel }}
    </button>

    <label class="vk-field">
      <span class="vk-field-label">分组</span>
      <select class="vk-select" data-testid="node-group" :value="group" @change="onGroup">
        <option value="">全部分组</option>
        <option v-for="g in groups" :key="g" :value="g">
          {{ g }}
        </option>
      </select>
    </label>

    <div class="vk-field">
      <span class="vk-field-label">状态</span>
      <div class="vk-status-filter" role="group" aria-label="状态筛选">
        <button
          v-for="s in STATUS_OPTIONS"
          :key="s"
          class="vk-status-btn"
          type="button"
          :data-status="s"
          :aria-pressed="status === s"
          :data-active="status === s"
          :data-testid="`node-status-${s}`"
          @click="onStatus(s)"
        >
          {{ STATUS_FILTER_LABELS[s] }}
        </button>
      </div>
    </div>

    <p class="vk-toolbar-count" data-testid="node-count">
      显示 {{ visibleCount }} / {{ totalCount }}
    </p>
  </section>
</template>
