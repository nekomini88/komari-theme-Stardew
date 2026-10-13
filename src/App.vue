<script setup lang="ts">
import type { Season, TimeOfDay, Weather } from '@/v2/theme/sceneState'
/**
 * v2 应用壳（App shell）
 *
 * 结构：Provider(主题/暗色基础) → 场景图层栈 SceneStack → 顶栏 → 主区(RouterView) → 页脚。
 * 功能面保留：initApp() 驱动 /api/clients + /api/rpc2 的传输/轮询/WebSocket；
 * 路由 / 与 /instance/:id 由 router 定义；主题与语言切换、admin 入口在 TopBar。
 *
 * 场景世界（时间 / 季节 / 天气）：
 *  - 基准一律是**我们的时间（UTC+8，取自服务端 Date 头）**，不跟随访客本地时钟；
 *    访客时钟只当滴答器，即使访客系统时间不准或身处其他时区，看到的世界也一致。
 *  - 手动覆盖只走 `komari-theme.json` 声明的配置项；**已移除全部 URL 覆盖口**。
 *  - 每 60s 走一格，让日夜与季节自然推进。
 */
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import Provider from '@/components/Provider.vue'
import { Toaster } from '@/components/ui/sonner'
import { useAppStore } from '@/stores/app'
import { destroyInitManager, initApp } from '@/utils/init'
import { hasServerAnchor, worldDay, worldHour, worldMonth, worldYear } from '@/utils/serverClock'
import AppFooter from '@/v2/components/AppFooter.vue'
import BackToTop from '@/v2/components/BackToTop.vue'
import SceneStack from '@/v2/components/SceneStack.vue'
import TopBar from '@/v2/components/TopBar.vue'
import { resolveSceneConfig } from '@/v2/theme/sceneConfig'
import { seasonFromMonth, timeOfDayFromHour, weatherFromDaySeed } from '@/v2/theme/sceneState'

const appStore = useAppStore()

/** 世界时钟滴答间隔：只为让日夜/季节推进，无需每帧重绘 */
const WORLD_TICK_MS = 60_000

const clockNowMs = ref(Date.now())
let tickTimer: ReturnType<typeof setInterval> | undefined

/** 管理员配置（不可信输入 → 强类型，非法值自动退回默认） */
const sceneConfig = computed(() => resolveSceneConfig(appStore.publicSettings?.theme_settings))

const sceneTime = computed<TimeOfDay>(() => {
  const cfg = sceneConfig.value
  return cfg.timeMode === 'fixed'
    ? cfg.fixedTime
    : timeOfDayFromHour(worldHour(clockNowMs.value))
})

const sceneSeason = computed<Season>(() => {
  const cfg = sceneConfig.value
  return cfg.seasonMode === 'fixed'
    ? cfg.fixedSeason
    : seasonFromMonth(worldMonth(clockNowMs.value))
})

const sceneWeather = computed<Weather>(() => {
  const cfg = sceneConfig.value
  if (cfg.weatherMode === 'off')
    return 'clear'
  if (cfg.weatherMode === 'fixed')
    return cfg.fixedWeather
  return weatherFromDaySeed(
    worldYear(clockNowMs.value),
    worldMonth(clockNowMs.value),
    worldDay(clockNowMs.value),
    sceneSeason.value,
  )
})

onMounted(async () => {
  try {
    await initApp()
  }
  catch (error) {
    console.error('[App] Initialization failed:', error)
  }

  // 启动请求已顺手带回服务端 Date 头，此处重算让世界时钟立即对齐
  clockNowMs.value = Date.now()
  if (!hasServerAnchor()) {
    console.warn('[App] 未取得服务端时间基准，世界时钟退回「访客时钟 + UTC+8」')
  }

  tickTimer = setInterval(() => {
    clockNowMs.value = Date.now()
  }, WORLD_TICK_MS)

  await nextTick()
})

onUnmounted(() => {
  if (tickTimer !== undefined)
    clearInterval(tickTimer)
  destroyInitManager()
})
</script>

<template>
  <Provider>
    <div class="vk-app" :data-scene-time="sceneTime" :data-scene-season="sceneSeason" :data-scene-weather="sceneWeather">
      <SceneStack :time="sceneTime" :season="sceneSeason" :weather="sceneWeather" />
      <TopBar />
      <main class="vk-main">
        <RouterView />
      </main>
      <AppFooter />
      <BackToTop />
      <Toaster position="top-center" rich-colors close-button />
    </div>
  </Provider>
</template>
