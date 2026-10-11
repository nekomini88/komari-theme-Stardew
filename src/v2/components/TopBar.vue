<script setup lang="ts">
/**
 * v2 顶栏：站点标识 + 首页入口 + 主题/语言切换 + admin 入口。
 * 功能面保留（ART_SYSTEM 目标）：主题与语言切换、admin 入口不丢。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const appStore = useAppStore()

const t = computed(() => appStore.lang === 'zh-CN'
  ? { home: '首页', admin: '后台管理', theme: '切换主题', lang: '切换语言' }
  : { home: 'Home', admin: 'Admin', theme: 'Switch theme', lang: 'Switch language' })

const sitename = computed(() => appStore.publicSettings?.sitename || 'NekoVPS')

const showAdmin = computed(() => appStore.isLoggedIn || !appStore.hideAdminEntryWhenLoggedOut)

const themeLabel = computed(() => {
  const labels = appStore.lang === 'zh-CN'
    ? { auto: '自动', light: '亮', dark: '暗' }
    : { auto: 'Auto', light: 'Light', dark: 'Dark' }
  return labels[appStore.themeMode]
})

function cycleTheme() {
  const order = ['auto', 'light', 'dark'] as const
  const i = order.indexOf(appStore.themeMode)
  appStore.updateThemeMode(order[(i + 1) % order.length]!)
}

function toggleLang() {
  appStore.lang = appStore.lang === 'zh-CN' ? 'en-US' : 'zh-CN'
}

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

      <div class="vk-actions">
        <button class="vk-btn" type="button" :aria-label="t.theme" :title="t.theme" @click="cycleTheme">
          {{ themeLabel }}
        </button>
        <button class="vk-btn" type="button" :aria-label="t.lang" :title="t.lang" @click="toggleLang">
          {{ appStore.lang === 'zh-CN' ? '中文' : 'EN' }}
        </button>
        <button v-if="showAdmin" class="vk-btn" type="button" :aria-label="t.admin" :title="t.admin" @click="goAdmin">
          {{ t.admin }}
        </button>
      </div>
    </div>
  </header>
</template>
