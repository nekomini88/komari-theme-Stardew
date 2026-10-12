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
import { seasonFromMonth, timeOfDayFromHour, WEATHERS, weatherFromDate } from '@/v2/theme/sceneState'
import type { Season, TimeOfDay, Weather } from '@/v2/theme/sceneState'
import AppFooter from '@/v2/components/AppFooter.vue'
import BackToTop from '@/v2/components/BackToTop.vue'
import SceneStack from '@/v2/components/SceneStack.vue'
import TopBar from '@/v2/components/TopBar.vue'

const now = new Date()

/**
 * 场景时间/季节默认由访客本地时间驱动；
 * 支持 `?scene=day|dusk|night&season=spring|summer|autumn|winter` 覆盖，仅用于预览/截图，不改数据层语义。
 */
const TIMES: readonly TimeOfDay[] = ['day', 'dusk', 'night']
const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter']
const params = new URLSearchParams(window.location.search)
const timeParam = params.get('scene')
const seasonParam = params.get('season')

const sceneTime = ref(
  timeParam && (TIMES as readonly string[]).includes(timeParam)
    ? (timeParam as TimeOfDay)
    : timeOfDayFromHour(now.getHours()),
)
const sceneSeason = ref(
  seasonParam && (SEASONS as readonly string[]).includes(seasonParam)
    ? (seasonParam as Season)
    : seasonFromMonth(now.getMonth() + 1),
)

/** 彩蛋取证：?life=force 时把一只动物钉在画面里（仅截图/探针用，默认不计） */
const forceLife = params.get('life') === 'force'

/** 天气：默认由「当天日期 × 季节」确定性推出；?weather=clear|rain|snow|wind|fog 可覆盖（预览/截图） */
const weatherParam = params.get('weather')
const sceneWeather = ref<Weather>(
  weatherParam && (WEATHERS as readonly string[]).includes(weatherParam)
    ? (weatherParam as Weather)
    : weatherFromDate(now, sceneSeason.value),
)

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
    <div class="vk-app" :data-scene-time="sceneTime" :data-scene-season="sceneSeason" :data-scene-weather="sceneWeather">
      <SceneStack :time="sceneTime" :season="sceneSeason" :weather="sceneWeather" :force-life="forceLife" />
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
