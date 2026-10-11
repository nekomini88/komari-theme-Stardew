<script lang="ts" setup>
import type { ToasterProps } from 'vue-sonner'

import { Toaster as Sonner } from 'vue-sonner'
import PixelIcon from '@/components/PixelIcon.vue'
import { cn } from '@/lib/utils'
import 'vue-sonner/style.css'

const props = defineProps<ToasterProps>()
</script>

<template>
  <Sonner
    :class="cn('toaster group', props.class)" :style="{
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'var(--border)',
      '--border-radius': 'var(--radius)',
    }" v-bind="props"
  >
    <template #success-icon>
      <PixelIcon name="lucide:circle-check" class="size-4" />
    </template>
    <template #info-icon>
      <PixelIcon name="lucide:info" class="size-4" />
    </template>
    <template #warning-icon>
      <PixelIcon name="lucide:triangle-alert" class="size-4" />
    </template>
    <template #error-icon>
      <PixelIcon name="lucide:octagon-x" class="size-4" />
    </template>
    <template #loading-icon>
      <div>
        <PixelIcon name="lucide:loader-2" class="size-4 animate-spin" />
      </div>
    </template>
    <template #close-icon>
      <PixelIcon name="lucide:x" class="size-4" />
    </template>
  </Sonner>
</template>
