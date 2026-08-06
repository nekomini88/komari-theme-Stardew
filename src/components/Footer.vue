<script setup lang="ts">
import type { VersionInfo } from '@/utils/api'
import { computed, onMounted, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { getSharedApi } from '@/utils/api'

const appStore = useAppStore()
const api = getSharedApi()

const buildVersion = __BUILD_VERSION__
const buildGitHash = __BUILD_GIT_HASH__

const serverVersion = ref<VersionInfo | null>(null)
const themeName = ref('Stardew-2')
const themeUrl = ref('https://github.com/nekomini88/komari-theme-Stardew')

onMounted(async () => {
  try {
    serverVersion.value = await api.getVersion()
  }
  catch {
    // 静默失败
  }
})

const formattedServerVersion = computed(() => serverVersion.value?.version ?? null)
const showIcp = computed(() => appStore.icpEnabled && appStore.icpNumber)
const showPolice = computed(() => appStore.policeEnabled && appStore.policeNumber)
const showFiling = computed(() => showIcp.value || showPolice.value)

function openLink(url: string) {
  // 兜底: <a target=_blank> 在部分环境(iframe/沙箱)可能被拦截,
  // 此处用 window.open 显式打开; 若被 popup blocker 拦截则降级为当前页导航
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  if (!win) {
    window.location.href = url
  }
}

function onLinkClick(e: MouseEvent, url: string) {
  // 允许 Ctrl/Cmd/Middle-click 走浏览器原生行为(新标签), 其余场景确保导航
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return
  e.preventDefault()
  openLink(url)
}
</script>

<template>
  <footer class="w-full flex flex-row items-center justify-between max-w-[1600px] mx-auto p-4">
    <div class="flex gap-1 items-center text-xs text-muted-foreground">
      Powered by
      <a
        href="https://github.com/komari-monitor/komari"
        target="_blank"
        rel="noopener noreferrer"
        class="font-medium text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground transition-opacity hover:opacity-80"
        @click="onLinkClick($event, 'https://github.com/komari-monitor/komari')"
      >Komari Monitor</a>
    </div>
    <div class="flex gap-1 items-center text-xs text-muted-foreground">
      Theme by
      <a
        :href="themeUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="font-medium text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground transition-opacity hover:opacity-80"
        @click="onLinkClick($event, themeUrl)"
      >{{ themeName }}</a>
    </div>

    <div v-if="showFiling" class="flex flex-wrap gap-2 items-center justify-center sm:flex-shrink-0">
      <a
        v-if="showIcp" :href="appStore.icpUrl" target="_blank" rel="noopener noreferrer"
        class="transition-opacity hover:opacity-70"
      >
        <span class="text-xs text-muted-foreground">{{ appStore.icpNumber || '' }}</span>
      </a>
      <span v-if="showIcp && showPolice" class="opacity-50 text-xs text-muted-foreground">·</span>
      <template v-if="showPolice">
        <a
          v-if="appStore.policeUrl" :href="appStore.policeUrl" target="_blank" rel="noopener noreferrer"
          class="transition-opacity hover:opacity-70"
        >
          <span class="text-xs text-muted-foreground">{{ appStore.policeNumber || '' }}</span>
        </a>
        <span v-else class="text-xs text-muted-foreground">{{ appStore.policeNumber || '' }}</span>
      </template>
    </div>
  </footer>
</template>
