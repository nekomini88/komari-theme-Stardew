<script setup lang="ts">
/**
 * 调色板控件（用户 2026-10-13：「设置一个按钮控制服务器颜色, 名称为调色板, 按钮控件你选合适的」）。
 *
 * 控件选型：顶栏按钮 + 下拉菜单。
 *   - 比原生 <select> 好在能直接显示六色色块预览（选配色的关键信息是"长什么样"）；
 *   - 不引入任何新依赖（项目已有 reka-ui，但这里用文档级点击/ESC 关闭即可，逻辑更小更可控）。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { usePalette } from '@/v2/data/paletteStore'

const { mode, options, setPaletteMode, rerollRandom } = usePalette()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

function toggle() {
  open.value = !open.value
}

function pick(m: (typeof options)[number]['mode']) {
  setPaletteMode(m)
  open.value = false
}

function onDocClick(e: MouseEvent) {
  if (!open.value) return
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}

function onKey(e: KeyboardEvent) {
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
      aria-haspopup="menu"
      :aria-expanded="open"
      title="调色板：切换服务器配色"
      @click="toggle"
    >
      调色板
    </button>

    <div v-if="open" class="vk-palette-menu" role="menu" aria-label="调色板">
      <p class="vk-palette-title">服务器配色</p>
      <button
        v-for="opt in options"
        :key="opt.mode"
        class="vk-palette-item"
        type="button"
        role="menuitemradio"
        :aria-checked="mode === opt.mode"
        :data-active="mode === opt.mode ? 'on' : 'off'"
        @click="pick(opt.mode)"
      >
        <span class="vk-palette-swatch" aria-hidden="true">
          <i
            v-for="(c, i) in (opt.colors.length ? opt.colors : ['#7956b2', '#d65db1', '#ff6f91', '#ff9671', '#ffc75f', '#f9f871'])"
            :key="i"
            :style="{ background: opt.mode === 'random' ? 'transparent' : c }"
            :data-random="opt.mode === 'random' ? 'on' : 'off'"
          />
        </span>
        <span class="vk-palette-text">
          <b>{{ opt.label }}</b>
          <small>{{ opt.hint }}</small>
        </span>
        <span v-if="mode === opt.mode" class="vk-palette-check" aria-hidden="true">✓</span>
      </button>

      <button
        v-if="mode === 'random'"
        class="vk-palette-reroll"
        type="button"
        @click="rerollRandom()"
      >
        换一批随机色
      </button>
    </div>
  </div>
</template>
