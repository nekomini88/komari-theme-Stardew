<script setup lang="ts">
/**
 * v2 应用壳（App shell）
 *
 * 结构：Provider(主题/暗色基础) → 场景图层栈 SceneStack → 顶栏 → 主区(RouterView) → 页脚。
 * 功能面保留：initApp() 驱动 /api/clients + /api/rpc2 的传输/轮询/WebSocket；
 * 路由 / 与 /instance/:id 由 router 定义；主题与语言切换、admin 入口在 TopBar。
 * 场景时间/季节由真实时间驱动（timeOfDayFromHour / seasonFromMonth）。
 */
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { Toaster } from '@/components/ui/sonner'
import Provider from '@/components/Provider.vue'
import { destroyInitManager, initApp } from '@/utils/init'
import { seasonFromMonth, timeOfDayFromHour } from '@/v2/theme/sceneState'
import AppFooter from '@/v2/components/AppFooter.vue'
import SceneStack from '@/v2/components/SceneStack.vue'
import TopBar from '@/v2/components/TopBar.vue'

const now = new Date()
const sceneTime = ref(timeOfDayFromHour(now.getHours()))
const sceneSeason = ref(seasonFromMonth(now.getMonth() + 1))

onMounted(async () => {
  try {
    await initApp()
  }
  catch (error) {
    console.error('[App] Initialization failed:', error)
  }
  await nextTick()
})

onUnmounted(() => {
  destroyInitManager()
})
</script>

<template>
  <Provider>
    <div class="vk-app">
      <SceneStack :time="sceneTime" :season="sceneSeason">
        <!-- mid 层槽位：首页节点卡片「住」在这里（ART_SYSTEM §2），底部对齐 ground 基线 -->
        <template #mid>
          <div id="vk-scene-mid" class="vk-mid-slot" data-scene-slot="mid" />
        </template>
      </SceneStack>
      <TopBar />
      <main class="vk-main">
        <RouterView />
      </main>
      <AppFooter />
      <Toaster position="top-center" rich-colors close-button />
    </div>
  </Provider>
</template>
