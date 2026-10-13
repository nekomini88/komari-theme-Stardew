<script setup lang="ts">
/**
 * v2 顶栏：站点标识 + 首页入口 + admin 入口。
 *
 * 用户 2026-10-13 口径：**不要**明/暗切换与中英文切换按钮（"不需要这些功能"）。
 * 摘除后主题跟随系统（Provider.vue 的 auto 逻辑不变），界面语言固定中文
 * （store 里 lang 本就是未持久化的 ref('zh-CN')，无残留状态）。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import PaletteMenu from '@/v2/components/PaletteMenu.vue'

const router = useRouter()
const appStore = useAppStore()

// 语言切换已移除 → 顶栏文案固定中文，不再依赖 lang 分支
const t = computed(() => ({ home: '首页', admin: '后台管理' }))

const sitename = computed(() => appStore.publicSettings?.sitename || 'NekoVPS')

const showAdmin = computed(() => appStore.isLoggedIn || !appStore.hideAdminEntryWhenLoggedOut)

function goAdmin() {
  location.href = '/admin'
}
</script>

<template>
  <header class="vk-topbar">
    <div class="vk-topbar-inner">
      <button class="vk-brand" type="button" @click="router.push('/')">
        <span class="vk-brand-mark" aria-hidden="true" />
        <span class="vk-title">{{ sitename }}</span>
      </button>

      <nav class="vk-nav" aria-label="primary">
        <button class="vk-btn" type="button" @click="router.push('/')">
          {{ t.home }}
        </button>
      </nav>

      <!-- 按用户口径去掉「明/暗切换」与「中英文切换」按钮；新增「调色板」控件 -->
      <div class="vk-actions">
        <PaletteMenu />
        <button v-if="showAdmin" class="vk-btn" type="button" :aria-label="t.admin" :title="t.admin" @click="goAdmin">
          {{ t.admin }}
        </button>
      </div>
    </div>
  </header>
</template>
