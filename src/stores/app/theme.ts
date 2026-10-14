/**
 * `useAppStore` 的主题模式层：`themeMode` 的持久化与校验、系统深色偏好、最终深色判定。
 *
 * 校验 watcher 与原实现一致（`immediate: true`：非法持久化值立刻被纠正并按
 * useStorageAsync 的语义回写 localStorage）。
 */
import type { ShaderType, ThemeMode } from './types'
import { usePreferredDark, useStorageAsync } from '@vueuse/core'
import { computed, watch } from 'vue'
import { isValidThemeMode } from './constants'

/** 创建主题模式状态与派生值（返回类型保持推断，避免破坏 Pinia 对 state/getter 的推导） */
export function createTheme() {
  const themeMode = useStorageAsync<ThemeMode>('themeMode', 'auto', localStorage)

  // 使用 VueUse 的 usePreferredDark 检测系统主题偏好
  const prefersDark = usePreferredDark()

  watch(themeMode, (mode) => {
    if (!isValidThemeMode(mode)) {
      themeMode.value = 'auto'
    }
  }, { immediate: true })

  // 计算当前是否为暗色模式
  const isDark = computed(() => {
    if (themeMode.value === 'auto') {
      return prefersDark.value
    }
    return themeMode.value === 'dark'
  })

  const resolvedThemeMode = computed<'light' | 'dark'>(() => isDark.value ? 'dark' : 'light')

  // 只接受显式模式（Provider.vue 的 v-model setter 路径）
  function updateThemeMode(mode: ThemeMode) {
    themeMode.value = isValidThemeMode(mode) ? mode : 'auto'
  }

  return {
    themeMode,
    isDark,
    resolvedThemeMode,
    updateThemeMode,
  }
}

/**
 * shaderType 的初始读取：同步读 localStorage，不做合法性校验（与原实现一致）。
 */
export function readStoredShaderType(): ShaderType {
  return (localStorage.getItem('shaderType') as ShaderType) || 'bubbles'
}
