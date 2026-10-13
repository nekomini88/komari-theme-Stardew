<script setup lang="ts">
/**
 * StatePlaceholder —— 加载 / 空 / 错误 三态占位块（M4 再换成插画素材）
 *
 * 本阶段用与母板同色的纯 CSS 方块占位：直角、1px(#2b1d16→--vk-outline) 描边、无渐变。
 * 状态信息「图形标记 + 文字」双重表达，不只靠颜色（ART_SYSTEM §1.4）。
 * 错误态带重试入口，向上 emit('retry')，由 HomeView 调 useClients().retry()。
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  state: 'loading' | 'empty' | 'error'
  /** 覆盖默认文案 */
  message?: string
  /** 空态/错误态下的补充说明 */
  detail?: string
}>(), {
  message: '',
  detail: '',
})

const emit = defineEmits<{ retry: [] }>()

const DEFAULT_MESSAGE: Record<'loading' | 'empty' | 'error', string> = {
  loading: '载入中…',
  empty: '暂无节点',
  error: '数据刷新失败',
}

const text = computed(() => props.message || DEFAULT_MESSAGE[props.state])
/** 复用既有 testid 约定：home-loading / home-empty / home-error */
const testId = computed(() => `home-${props.state}`)
</script>

<template>
  <div
    class="vk-state"
    :data-state="state"
    :data-testid="testId"
    role="status"
    :aria-live="state === 'error' ? 'assertive' : 'polite'"
  >
    <span class="vk-state-mark" :data-state="state" aria-hidden="true" />
    <div class="vk-state-body">
      <p class="vk-state-text" data-testid="state-text">
        {{ text }}
      </p>
      <p v-if="detail" class="vk-state-detail">
        {{ detail }}
      </p>
    </div>
    <button
      v-if="state === 'error'"
      class="vk-btn vk-state-retry"
      type="button"
      data-testid="state-retry"
      @click="emit('retry')"
    >
      重试
    </button>
  </div>
</template>
