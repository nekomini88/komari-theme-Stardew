<script setup lang="ts">
/**
 * 像素图标:优先用 AI 生成的像素 sprite(1px 深棕描边 + 受限调色板),
 * 没有对应素材时自动回落到 Iconify 矢量图标 —— 保证任何情况下不空白。
 */
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { ICONIFY_TO_PIXEL, PIXEL_ICONS } from '@/utils/pixelIcons'

const props = withDefaults(defineProps<{
  /** Iconify 名(如 mdi:earth)或像素图 key(如 globe) */
  name: string
  size?: number | string
  alt?: string
}>(), { size: 16 })

const px = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
const key = computed(() => ICONIFY_TO_PIXEL[props.name] ?? props.name)
const url = computed(() => PIXEL_ICONS[key.value])
</script>

<template>
  <img
    v-if="url"
    class="pixel-icon"
    :src="url"
    :style="{ width: px, height: px }"
    :alt="alt ?? ''"
    aria-hidden="true"
  >
  <Icon v-else :icon="name" :width="size" :height="size" />
</template>

<style scoped>
.pixel-icon {
  display: inline-block;
  flex: none;
  image-rendering: pixelated;
  vertical-align: -0.125em;
}
</style>
