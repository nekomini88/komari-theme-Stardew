/**
 * `useAppStore` 的本地持久化界面偏好层：节点分组选择、节点视图模式、背景着色器、首页滚动记忆。
 *
 * 关键契约（拆分前已由 tests/unit/stores/test 冻结，拆分后逐条保持一致）：
 * - `storedViewMode` 用 null 表示「未设置」，等主题配置加载后由 watch 落盘默认值；
 * - 视图模式 getter 对非法持久化值只回落默认值，**不回写** localStorage；
 * - shaderType 只做「赋值 → 同步写回」，初始读取不校验合法性。
 */
import type { ComputedRef, Ref } from 'vue'
import type { NodeViewMode, ShaderType } from './types'
import type { PublicSettings } from '@/utils/api/api'
import { useStorageAsync } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { isValidViewMode } from './constants'
import { readStoredShaderType } from './theme'

/**
 * 创建持久化的界面偏好状态。
 * @param publicSettings store 持有的公共设置 ref（与主题配置派生层共享同一份状态）
 * @param defaultViewMode 由主题配置派生的默认视图模式
 */
export function createPersistedUiState(
  publicSettings: Ref<PublicSettings | undefined>,
  defaultViewMode: ComputedRef<NodeViewMode>,
) {
  const nodeSelectedGroup = useStorageAsync<string>('nodeSelectedGroup', 'all', localStorage)
  const shaderType = ref<ShaderType>(readStoredShaderType())

  // 同步持久化 shaderType
  watch(shaderType, (val) => {
    localStorage.setItem('shaderType', val)
  })

  // 首页滚动位置记忆
  const homeScrollPosition = ref<number>(0)

  // 使用 null 表示未设置，等待主题配置加载后决定
  const storedViewMode = useStorageAsync<NodeViewMode | null>('nodeViewMode', null, localStorage)

  // 当前实际使用的视图模式
  const nodeViewMode = computed<NodeViewMode>({
    get: () => {
      // 校验 storedViewMode 是否为合法值，非法值时使用默认值
      if (storedViewMode.value !== null && isValidViewMode(storedViewMode.value)) {
        return storedViewMode.value
      }
      return defaultViewMode.value
    },
    set: (val) => {
      storedViewMode.value = val
    },
  })

  // 当 publicSettings 加载后，如果 localStorage 没有保存过视图模式或值为非法值，使用默认值
  watch(publicSettings, (settings) => {
    if (settings && !isValidViewMode(storedViewMode.value)) {
      // 触发 computed setter，会自动保存到 localStorage
      storedViewMode.value = defaultViewMode.value
    }
  }, { immediate: true })

  return {
    nodeSelectedGroup,
    shaderType,
    nodeViewMode,
    homeScrollPosition,
  }
}
