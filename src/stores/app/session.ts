/**
 * `useAppStore` 的运行态 / 会话层：加载标志、界面语言、公共设置、登录态与连接错误。
 *
 * `publicSettings` 是 store 的唯一公共设置入口，主题配置派生层与持久化层都从这里取同一份 ref。
 */
import type { Ref } from 'vue'
import type { Lang } from './types'
import type { PublicSettings } from '@/utils/api/api'
import { ref } from 'vue'

export interface AppSession {
  loading: Ref<boolean>
  lang: Ref<Lang>
  publicSettings: Ref<PublicSettings | undefined>
  isLoggedIn: Ref<boolean>
  connectionError: Ref<boolean>
  updateLoginState: (loggedIn: boolean) => void
}

/** 创建运行态与会话状态（无本地持久化，无 watcher） */
export function createSession(): AppSession {
  const loading = ref<boolean>(true)
  const lang = ref<Lang>('zh-CN')
  const publicSettings = ref<PublicSettings>()
  const isLoggedIn = ref<boolean>(false)
  const connectionError = ref<boolean>(false)

  function updateLoginState(loggedIn: boolean) {
    isLoggedIn.value = loggedIn
  }

  return {
    loading,
    lang,
    publicSettings,
    isLoggedIn,
    connectionError,
    updateLoginState,
  }
}
