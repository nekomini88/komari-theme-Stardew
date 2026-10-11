/**
 * v2 注入键（provide/inject）
 *
 * 用于把数据获取器（fetcher）从应用壳注入到业务视图，便于单测/e2e 注入 mock，
 * 生产环境下不提供该键时 fetchClients 回落到 globalThis.fetch。
 */

import type { InjectionKey } from 'vue'
import type { Fetcher } from './client'

/** 节点数据 fetcher（/api/rpc2 调用器）的注入键 */
export const CLIENTS_FETCHER_KEY: InjectionKey<Fetcher> = Symbol('v2.clientsFetcher')

/** 轮询间隔（ms）的注入键，缺省时视图使用自身默认值 */
export const CLIENTS_INTERVAL_KEY: InjectionKey<number> = Symbol('v2.clientsInterval')
