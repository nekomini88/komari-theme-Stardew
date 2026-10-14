import type { ByteDecimalsConfig } from '@/utils/format/helper'
import { defineStore } from 'pinia'
import { computed } from 'vue'
import { BYTE_DECIMALS } from './app/constants'
import { createPersistedUiState } from './app/persistence'
import { createSession } from './app/session'
import { createTheme } from './app/theme'
import { createThemeSettings } from './app/themeSettings'

export type { ShaderType, ThemeMode } from './app/types'

/**
 * 应用级 store（对外 API 与拆分前完全一致）。
 *
 * 内部按职责拆到 `./app/` 下的四个子模块，store 主体只负责组装与对外暴露：
 * - `app/session.ts`      运行态与会话：loading / lang / publicSettings / 登录态 / 连接错误
 * - `app/themeSettings.ts` 主题配置派生 getter（全部来自 publicSettings.theme_settings）
 * - `app/persistence.ts`  本地持久化的界面偏好：分组选择 / 视图模式 / shaderType / 首页滚动位置
 * - `app/theme.ts`        主题模式、系统深色偏好与最终深色判定
 * - `app/constants.ts`    固定配置与合法值校验
 *
 * 注意：子模块的调用顺序刻意与拆分前 watcher 的注册顺序一致
 * （shaderType → publicSettings → themeMode），避免改变既有的响应式时序。
 */
const useAppStore = defineStore('app', () => {
  // 运行态与会话
  const { loading, lang, publicSettings, isLoggedIn, connectionError, updateLoginState } = createSession()

  // 主题配置派生
  const themeSettings = createThemeSettings(publicSettings)

  // 本地持久化的界面偏好
  const { nodeSelectedGroup, shaderType, nodeViewMode, homeScrollPosition } = createPersistedUiState(publicSettings, themeSettings.defaultViewMode)

  // 主题模式与深色判定
  const { themeMode, isDark, resolvedThemeMode, updateThemeMode } = createTheme()

  // 字节格式化精度（固定配置，按实例浅拷贝）
  const byteDecimals: ByteDecimalsConfig = { ...BYTE_DECIMALS }

  // 计算属性：当前主题模式下的背景 URL
  const currentBackgroundUrl = computed<string>(() => {
    if (resolvedThemeMode.value === 'dark') {
      return themeSettings.darkBackgroundUrl.value
    }
    return themeSettings.lightBackgroundUrl.value
  })

  return {
    loading,
    themeMode,
    isDark,
    resolvedThemeMode,
    lang,
    nodeSelectedGroup,
    nodeViewMode,
    defaultViewMode: themeSettings.defaultViewMode,
    rpcTransportMode: themeSettings.rpcTransportMode,
    byteDecimals,
    alertEnabled: themeSettings.alertEnabled,
    alertTitle: themeSettings.alertTitle,
    alertContent: themeSettings.alertContent,
    stopEarth: themeSettings.stopEarth,
    hideEarth: themeSettings.hideEarth,
    hideGeneralCard: themeSettings.hideGeneralCard,
    summaryCards: themeSettings.summaryCards,
    nodeCardMinWidth: themeSettings.nodeCardMinWidth,
    showNodeConnections: themeSettings.showNodeConnections,
    showNodeUptime: themeSettings.showNodeUptime,
    visitorInfoCardEnabled: themeSettings.visitorInfoCardEnabled,
    hideAdminEntryWhenLoggedOut: themeSettings.hideAdminEntryWhenLoggedOut,
    disablePageAnimation: themeSettings.disablePageAnimation,
    enableGlassEffect: themeSettings.enableGlassEffect,
    icpEnabled: themeSettings.icpEnabled,
    icpNumber: themeSettings.icpNumber,
    icpUrl: themeSettings.icpUrl,
    policeEnabled: themeSettings.policeEnabled,
    policeNumber: themeSettings.policeNumber,
    policeUrl: themeSettings.policeUrl,
    backgroundEnabled: themeSettings.backgroundEnabled,
    backgroundType: themeSettings.backgroundType,
    lightBackgroundUrl: themeSettings.lightBackgroundUrl,
    darkBackgroundUrl: themeSettings.darkBackgroundUrl,
    currentBackgroundUrl,
    backgroundBlur: themeSettings.backgroundBlur,
    backgroundOverlay: themeSettings.backgroundOverlay,
    shaderType,
    isLoggedIn,
    publicSettings,
    connectionError,
    homeScrollPosition,
    updateThemeMode,
    updateLoginState,
  }
})

export { useAppStore }
