<script setup lang="ts">
/**
 * 调色板控件（用户 2026-10-13：「设置一个按钮控制服务器颜色, 名称为调色板, 按钮控件你选合适的」）。
 *
 * 目前菜单里只有 flatpaper 一项（玻璃已按用户口径删除）；用户明确要求**保留按钮**做占位，
 * 以后再加配色时只需往 palettes.ts 的 PALETTE_MODES 加一项。
 *
 * 控件选型：顶栏按钮 + 下拉菜单。
 *   - 比原生 <select> 好在能直接显示外观预览（选外观的关键是"看长什么样"）；
 *   - 不引入新依赖。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { usePalette } from '@/v2/data/paletteStore'

const { mode, options, setPaletteMode } = usePalette()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const current = computed(() => options.find((o) => o.mode === mode.value) ?? options[0]!)

function choose(m: typeof mode.value): void {
  setPaletteMode(m)
  open.value = false
}

function onDocClick(e: MouseEvent): void {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="vk-palette">
    <button
      class="vk-btn"
      type="button"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click.stop="open = !open"
    >
      调色板
    </button>
    <div v-if="open" class="vk-palette-menu" role="listbox">
      <button
        v-for="o in options"
        :key="o.mode"
        type="button"
        role="option"
        class="vk-palette-item"
        :class="{ 'vk-palette-item-on': o.mode === mode }"
        :aria-selected="o.mode === mode"
        @click.stop="choose(o.mode)"
      >
        <span class="vk-palette-swatch">
          <i
            v-for="(c, i) in o.colors"
            :key="i"
            class="vk-palette-chip"
            :style="{ backgroundColor: c }"
          />
        </span>
        <span class="vk-palette-text">
          <b class="vk-palette-label">{{ o.label }}</b>
          <em class="vk-palette-hint">{{ o.hint }}</em>
        </span>
      </button>
    </div>
  </div>
</template>
