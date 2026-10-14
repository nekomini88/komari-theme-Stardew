/**
 * `useAppStore` 的主题配置派生层：把 `publicSettings.theme_settings` 解析成一组只读 getter。
 *
 * 全部沿用仓库既有的防御式解析约定：`typeof` 校验 + 合法值白名单 + 兜底默认值。
 * 这些 getter 原先直接写在 stores/app.ts 里，拆分时函数体一字未改（仅把
 * `publicSettings.value?.theme_settings` 提取成 `readThemeSettings()` 局部读取，
 * 读取位置仍在各 computed 内部，响应式依赖不变）。
 */
import type { Ref } from 'vue'
import type { NodeViewMode, RpcTransportMode, SummaryCardType } from './types'
import type { PublicSettings } from '@/utils/api/api'
import { computed } from 'vue'
import { DEFAULT_SUMMARY_CARDS, VALID_SUMMARY_CARDS } from './constants'

/**
 * 从 store 的 publicSettings ref 派生全部主题配置 getter。
 * @param publicSettings store 持有的公共设置 ref（由调用方创建，保证共享同一份状态）
 */
export function createThemeSettings(publicSettings: Ref<PublicSettings | undefined>) {
  function readThemeSettings(): Record<string, unknown> | null | undefined {
    return publicSettings.value?.theme_settings
  }

  // 计算属性：从主题配置获取默认视图模式
  const defaultViewMode = computed<NodeViewMode>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.defaultViewMode === 'string') {
      const mode = settings.defaultViewMode
      if (mode === 'card' || mode === 'list') {
        return mode
      }
    }
    return 'card'
  })

  // 计算属性：从主题配置获取 RPC 连接模式
  const rpcTransportMode = computed<RpcTransportMode>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.rpcTransportMode === 'string') {
      const mode = settings.rpcTransportMode
      if (mode === 'websocket' || mode === 'http') {
        return mode
      }
    }
    return 'websocket'
  })

  // 计算属性：公告配置
  const alertEnabled = computed<boolean>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.alertEnabled === 'boolean') {
      return settings.alertEnabled
    }
    return false
  })

  const alertTitle = computed<string>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.alertTitle === 'string') {
      return settings.alertTitle
    }
    return ''
  })

  const alertContent = computed<string>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.alertContent === 'string') {
      return settings.alertContent
    }
    return ''
  })

  const stopEarth = computed<boolean>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.stopEarth === 'boolean') {
      return settings.stopEarth
    }
    return false
  })

  const hideEarth = computed<boolean>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.hideEarth === 'boolean') {
      return settings.hideEarth
    }
    return false
  })

  const hideGeneralCard = computed<boolean>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.hideGeneralCard === 'boolean') {
      return settings.hideGeneralCard
    }
    return false
  })

  const summaryCards = computed<SummaryCardType[]>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.summaryCards === 'string' && settings.summaryCards.trim()) {
      const parsed = settings.summaryCards.split(',').map((s: string) => s.trim()).filter((s: string) => VALID_SUMMARY_CARDS.includes(s as SummaryCardType)) as SummaryCardType[]
      if (parsed.length > 0) {
        return parsed.slice(0, 6)
      }
    }
    return DEFAULT_SUMMARY_CARDS
  })

  const nodeCardMinWidth = computed<number>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.nodeCardMinWidth === 'number' && settings.nodeCardMinWidth >= 200) {
      return settings.nodeCardMinWidth
    }
    return 300
  })

  const showNodeConnections = computed<boolean>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.showNodeConnections === 'boolean') {
      return settings.showNodeConnections
    }
    return true
  })

  const showNodeUptime = computed<boolean>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.showNodeUptime === 'boolean') {
      return settings.showNodeUptime
    }
    return true
  })

  const visitorInfoCardEnabled = computed<boolean>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.visitorInfoCardEnabled === 'boolean') {
      return settings.visitorInfoCardEnabled
    }
    return true
  })

  const hideAdminEntryWhenLoggedOut = computed<boolean>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.hideAdminEntryWhenLoggedOut === 'boolean') {
      return settings.hideAdminEntryWhenLoggedOut
    }
    return false
  })

  const disablePageAnimation = computed<boolean>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.disablePageAnimation === 'boolean') {
      return settings.disablePageAnimation
    }
    return false
  })

  const enableGlassEffect = computed<boolean>(() => {
    const settings = readThemeSettings()
    if (!settings || settings.enableGlassEffect === undefined || settings.enableGlassEffect === null) {
      return true
    }
    const val = settings.enableGlassEffect
    if (typeof val === 'boolean')
      return val
    if (val === 'true' || val === '1')
      return true
    if (val === 'false' || val === '0')
      return false
    return true
  })

  // 计算属性：ICP 备案配置
  const icpEnabled = computed<boolean>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.icpEnabled === 'boolean') {
      return settings.icpEnabled
    }
    return false
  })

  const icpNumber = computed<string>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.icpNumber === 'string') {
      return settings.icpNumber
    }
    return ''
  })

  const icpUrl = computed<string>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.icpUrl === 'string' && settings.icpUrl.trim()) {
      return settings.icpUrl.trim()
    }
    return 'https://beian.miit.gov.cn/'
  })

  // 计算属性：公安备案配置
  const policeEnabled = computed<boolean>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.policeEnabled === 'boolean') {
      return settings.policeEnabled
    }
    return false
  })

  const policeNumber = computed<string>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.policeNumber === 'string') {
      return settings.policeNumber
    }
    return ''
  })

  const policeUrl = computed<string>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.policeUrl === 'string' && settings.policeUrl.trim()) {
      return settings.policeUrl.trim()
    }
    return ''
  })

  // 计算属性：自定义背景配置
  const backgroundEnabled = computed<boolean>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.backgroundEnabled === 'boolean') {
      return settings.backgroundEnabled
    }
    return false
  })

  const backgroundType = computed<'image' | 'video'>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.backgroundType === 'string') {
      const type = settings.backgroundType
      if (type === 'image' || type === 'video') {
        return type
      }
    }
    return 'image'
  })

  const lightBackgroundUrl = computed<string>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.lightBackgroundUrl === 'string') {
      return settings.lightBackgroundUrl.trim()
    }
    return ''
  })

  const darkBackgroundUrl = computed<string>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.darkBackgroundUrl === 'string') {
      return settings.darkBackgroundUrl.trim()
    }
    return ''
  })

  const backgroundBlur = computed<number>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.backgroundBlur === 'number' && settings.backgroundBlur >= 0) {
      return settings.backgroundBlur
    }
    return 0
  })

  const backgroundOverlay = computed<number>(() => {
    const settings = readThemeSettings()
    if (settings && typeof settings.backgroundOverlay === 'number' && settings.backgroundOverlay >= -100 && settings.backgroundOverlay <= 100) {
      return settings.backgroundOverlay
    }
    return 0
  })

  return {
    defaultViewMode,
    rpcTransportMode,
    alertEnabled,
    alertTitle,
    alertContent,
    stopEarth,
    hideEarth,
    hideGeneralCard,
    summaryCards,
    nodeCardMinWidth,
    showNodeConnections,
    showNodeUptime,
    visitorInfoCardEnabled,
    hideAdminEntryWhenLoggedOut,
    disablePageAnimation,
    enableGlassEffect,
    icpEnabled,
    icpNumber,
    icpUrl,
    policeEnabled,
    policeNumber,
    policeUrl,
    backgroundEnabled,
    backgroundType,
    lightBackgroundUrl,
    darkBackgroundUrl,
    backgroundBlur,
    backgroundOverlay,
  }
}
