<script setup lang="ts">
import { Icon } from '@iconify/vue'

export interface InfoItem {
  label: string
  value: string | undefined
  icon?: string
}

defineProps<{
  items: InfoItem[]
  /** grid 列数类名，默认三列 */
  cols?: string
}>()
</script>

<template>
  <div class="gap-3 grid" :class="cols || 'grid-cols-3'">
    <div
      v-for="(item, index) in items" :key="item.label"
      class="min-w-0 flex flex-col gap-1 rounded-sm bg-slate-500/5 p-2"
      :class="!index && cols === undefined && 'col-span-3'"
    >
      <div class="flex gap-1 items-center text-muted-foreground">
        <Icon v-if="item.icon" :icon="item.icon" :width="14" :height="14" />
        <span class="text-xs sm:text-sm">{{ item.label }}</span>
      </div>
      <slot name="value" :item="item">
        <span class="text-xs sm:text-sm break-all">{{ item.value }}</span>
      </slot>
    </div>
  </div>
</template>
