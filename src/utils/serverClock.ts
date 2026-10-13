/**
 * 服务端世界时钟（场景的时间基准）
 *
 * 口径（用户要求，勿改）：
 *  - 场景的时间 / 季节 / 天气**不跟随访客本地时钟**；
 *  - 一律以「我们的时间（UTC+8）」为准，访客时钟只当滴答器。
 *
 * 基准来源：任意一次同源请求的 HTTP `Date` 响应头（UTC，秒级精度）。
 * 该头是 CORS 安全列表响应头，同源 `fetch` 可直接读取，所以**不需要额外请求**——
 * 复用启动时已有的 `/api/public` 等调用即可建立锚点。
 *
 * 兜底：若始终拿不到服务端时间（离线 / 接口异常），退回「访客时钟 + UTC+8」，
 * 仅在失败路径启用，并由调用方输出告警。
 */

/** 世界时间固定为我们的时间：UTC+8 */
export const WORLD_UTC_OFFSET_HOURS = 8

const MS_PER_HOUR = 3_600_000

/** 服务端时间 − 客户端时间（毫秒）；null = 尚未取得锚点 */
let anchorOffsetMs: number | null = null

/** 只需要 headers.get 能力，便于单测注入假响应 */
export interface DateHeaderCarrier {
  headers: { get: (name: string) => string | null }
}

/**
 * 用 HTTP `Date` 头建立服务端锚点。
 *
 * `Date` 头只有秒级精度，因此以「请求往返中点」作为客户端参照时刻来抵消 RTT。
 *
 * @returns 是否成功建立锚点
 */
export function setServerAnchorFromDateHeader(
  dateHeader: string | null | undefined,
  requestStartMs: number,
  requestEndMs: number,
): boolean {
  if (!dateHeader)
    return false
  const serverMs = Date.parse(dateHeader)
  if (!Number.isFinite(serverMs))
    return false
  const clientRefMs = (requestStartMs + requestEndMs) / 2
  anchorOffsetMs = serverMs - clientRefMs
  return true
}

/** 从一次已完成的响应里提取并记录服务端时间；`requestStartMs` 需在 fetch 前取得 */
export function recordServerClockFrom(
  response: DateHeaderCarrier,
  requestStartMs: number,
  requestEndMs: number = Date.now(),
): boolean {
  return setServerAnchorFromDateHeader(response.headers.get('date'), requestStartMs, requestEndMs)
}

/** 清除锚点（单测用） */
export function clearServerAnchor(): void {
  anchorOffsetMs = null
}

/** 当前锚点偏移（毫秒）；null = 未取得服务端时间 */
export function serverAnchorOffsetMs(): number | null {
  return anchorOffsetMs
}

/** 是否已取得服务端时间基准 */
export function hasServerAnchor(): boolean {
  return anchorOffsetMs !== null
}

/**
 * 世界时间戳（毫秒）：客户端时钟 + 服务端锚点 + UTC+8 偏移。
 *
 * 已含 +8 小时，所以**用 `getUTC*` 系列读出来的就是北京墙钟**。
 */
export function worldTimeMs(clientNowMs: number = Date.now()): number {
  return clientNowMs + (anchorOffsetMs ?? 0) + WORLD_UTC_OFFSET_HOURS * MS_PER_HOUR
}

/** 世界墙钟 Date（读取请一律用 getUTC*） */
export function worldWallClock(clientNowMs: number = Date.now()): Date {
  return new Date(worldTimeMs(clientNowMs))
}

/** 我们的时间：当前小时 0-23 */
export function worldHour(clientNowMs: number = Date.now()): number {
  return worldWallClock(clientNowMs).getUTCHours()
}

/** 我们的时间：当前月份 1-12 */
export function worldMonth(clientNowMs: number = Date.now()): number {
  return worldWallClock(clientNowMs).getUTCMonth() + 1
}

/** 我们的时间：当前日期 1-31 */
export function worldDay(clientNowMs: number = Date.now()): number {
  return worldWallClock(clientNowMs).getUTCDate()
}

/** 我们的时间：当前年份 */
export function worldYear(clientNowMs: number = Date.now()): number {
  return worldWallClock(clientNowMs).getUTCFullYear()
}
