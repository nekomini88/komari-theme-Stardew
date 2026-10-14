import type { NodeViewMode, SummaryCardType, ThemeMode } from './types'
/**
 * `useAppStore` 的固定配置与合法性校验（纯数据 / 纯函数，无状态）。
 */
import type { ByteDecimalsConfig } from '@/utils/format/helper'

/** 固定的字节精度配置 */
export const BYTE_DECIMALS: ByteDecimalsConfig = {
  B: 0,
  KB: 0,
  MB: 1,
  GB: 1,
  TB: 2,
}

/** 校验主题模式是否为合法值 */
export function isValidThemeMode(value: unknown): value is ThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark'
}

/** 校验视图模式是否为合法值 */
export function isValidViewMode(value: string | null): value is NodeViewMode {
  return value === 'card' || value === 'list'
}

/** 合法的概览卡片种类白名单 */
export const VALID_SUMMARY_CARDS: SummaryCardType[] = ['memory', 'disk', 'finance', 'traffic', 'speedUp', 'speedDown', 'connections']

/** 未配置 summaryCards 时的默认卡片集合（不含 connections） */
export const DEFAULT_SUMMARY_CARDS: SummaryCardType[] = ['memory', 'disk', 'finance', 'traffic', 'speedUp', 'speedDown']
