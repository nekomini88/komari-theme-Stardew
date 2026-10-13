<script setup lang="ts">
/**
 * 场景素材组控件（用户 2026-10-13：「使用 gpt-image-2 那套, seedream 暂时保留（界面按钮可以切换）」）。
 *
 * 控件选型与 PaletteMenu 一致：顶栏按钮 + 下拉菜单（外观类选择要看"长什么样"，原生 select 做不到）。
 * 两项：gpt-image-2（默认）/ seedream；每项带一张缩略示意，固定用「夏季·白天」那张当封面
 * —— 缩略图只是用来分辨两套画风，不必跟随页面当前季节（顶栏也拿不到季节，硬塞会变成多余入参）。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useSceneSet } from '@/v2/data/sceneStore'
import { sceneUrlFor } from '@/v2/theme/sceneState'

/** 缩略示意固定用这一张（夏季·白天），仅用于分辨画风 */
const THUMB_SEASON = 'summer' as const

const { set, options, setSceneSet } = useSceneSet()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

function thumb(s: string): string {
  return sceneUrlFor(s as never, THUMB_SEASON, 'day')
}

function choose(s: typeof set.value): void {
  setSceneSet(s)
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
  <div ref="root" class="vk-sceneset">
    <button
      class="vk-btn"
      type="button"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click.stop="open = !open"
    >
      场景
    </button>
    <div v-if="open" class="vk-sceneset-menu" role="listbox">
      <button
        v-for="o in options"
        :key="o.set"
        type="button"
        role="option"
        class="vk-sceneset-item"
        :class="{ 'vk-sceneset-item-on': o.set === set }"
        :aria-selected="o.set === set"
        @click.stop="choose(o.set)"
      >
        <span class="vk-sceneset-thumb" :style="{ backgroundImage: `url(${thumb(o.set)})` }" />
        <span class="vk-sceneset-text">
          <b class="vk-sceneset-label">{{ o.label }}</b>
          <em class="vk-sceneset-hint">{{ o.hint }}</em>
        </span>
      </button>
    </div>
  </div>
</template>
