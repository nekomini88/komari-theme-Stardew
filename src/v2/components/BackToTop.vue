<script setup lang="ts">
/**
 * BackToTop —— 返回顶部按钮（木牌样式）
 *
 * 设计口径变更：旧实现是「现代白圆角浮钮」，现改为游戏内告示牌式木牌，
 * 走 v2 令牌（木纹面 + 柔和投影 + 蜜色内高光 + 圆角）。滚动 > 1px 出现。
 */
import { onMounted, onUnmounted, ref } from 'vue'

const props = withDefaults(defineProps<{ visibilityHeight?: number }>(), {
  visibilityHeight: 240,
})

const show = ref(false)

function handleScroll() {
  show.value = window.scrollY > props.visibilityHeight
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <Transition name="vk-backtop-fade">
    <button
      v-show="show"
      class="vk-backtop"
      type="button"
      aria-label="返回顶部"
      data-testid="back-to-top"
      @click="scrollToTop"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      <span>顶部</span>
    </button>
  </Transition>
</template>
