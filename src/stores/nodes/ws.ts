/**
 * `useNodesStore` 的 WebSocket 连接状态层（独立于节点数据，`clearNodes` 不会重置它）。
 */
import type { WsConnectionState } from './types'
import { ref } from 'vue'

/** 创建 WS 连接状态与方法 */
export function createWsState() {
  const wsConnectionState = ref<WsConnectionState>('disconnected')
  const wsReconnectAttempts = ref<number>(0)

  /**
   * 更新 WebSocket 连接状态
   */
  function updateWsState(state: WsConnectionState, attempts?: number): void {
    wsConnectionState.value = state
    if (attempts !== undefined) {
      wsReconnectAttempts.value = attempts
    }
  }

  return {
    wsConnectionState,
    wsReconnectAttempts,
    updateWsState,
  }
}
