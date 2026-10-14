/**
 * `useAppStore` 内部使用的本地类型。
 *
 * 这些类型原先直接声明在 stores/app.ts 顶部（或 store 函数体内），拆分时原样搬出，
 * 对外仍然通过 `@/stores/app` re-export，保证 `import type { ThemeMode } from '@/stores/app'`
 * 这类既有引用不失效。
 */

/** 主题模式：跟随系统 / 强制浅色 / 强制深色 */
export type ThemeMode = 'auto' | 'light' | 'dark'

/** 背景着色器类型 */
export type ShaderType = 'bubbles' | 'liquid' | 'none'

/** 界面语言 */
export type Lang = 'zh-CN' | 'en-US'

/** 节点列表视图模式 */
export type NodeViewMode = 'card' | 'list'

/** RPC 传输模式 */
export type RpcTransportMode = 'websocket' | 'http'

/** 概览卡片种类 */
export type SummaryCardType = 'memory' | 'disk' | 'finance' | 'traffic' | 'speedUp' | 'speedDown' | 'connections'
