import { afterEach, describe, expect, it } from 'vitest'
import {
  clearServerAnchor,
  hasServerAnchor,
  recordServerClockFrom,
  serverAnchorOffsetMs,
  setServerAnchorFromDateHeader,
  WORLD_UTC_OFFSET_HOURS,
  worldDay,
  worldHour,
  worldMonth,
  worldWallClock,
  worldYear,
} from '@/utils/serverClock'

/** 客户端参照时刻（本身不重要，关键是它与 Date 头的相对关系） */
const CLIENT_T = Date.parse('2026-10-12T04:00:00.000Z')

/** 用标准 toUTCString 造 Date 头，避免手写星期几出错 */
const hdr = (iso: string) => new Date(iso).toUTCString()

describe('世界时钟：基准是我们的时间（UTC+8），不跟随访客本地时钟', () => {
  afterEach(() => {
    clearServerAnchor()
  })

  it('世界时间固定为我们的时间：硬约定偏移 8 小时', () => {
    expect(WORLD_UTC_OFFSET_HOURS).toBe(8)
  })

  it('未取得锚点时退回「访客时钟 + UTC+8」', () => {
    expect(hasServerAnchor()).toBe(false)
    // 04:00Z + 8h = 12:00
    expect(worldHour(CLIENT_T)).toBe(12)
  })

  it('从 Date 头建立锚点：以请求往返中点抵消 RTT', () => {
    // 服务端 04:00:00Z，客户端往返 04:00:00.000 → 04:00:00.200，中点 = +100ms
    const ok = setServerAnchorFromDateHeader(
      hdr('2026-10-12T04:00:00Z'),
      CLIENT_T,
      CLIENT_T + 200,
    )
    expect(ok).toBe(true)
    expect(serverAnchorOffsetMs()).toBe(-100)
  })

  it('访客系统时间偏差被锚点吸收，世界时间仍然正确', () => {
    // 模拟访客时钟比真实快了 3 小时
    const skewed = CLIENT_T + 3 * 3600_000
    setServerAnchorFromDateHeader(hdr('2026-10-12T04:00:00Z'), skewed, skewed)
    // 世界时间 = 服务端 UTC 04:00 → 北京 12:00，与访客偏差无关
    expect(worldHour(skewed)).toBe(12)
    expect(worldDay(skewed)).toBe(12)
    expect(worldMonth(skewed)).toBe(10)
  })

  it('跨日：UTC 23:30 → 北京次日 07:30', () => {
    setServerAnchorFromDateHeader(hdr('2026-10-12T23:30:00Z'), CLIENT_T, CLIENT_T)
    expect(worldHour(CLIENT_T)).toBe(7)
    expect(worldDay(CLIENT_T)).toBe(13)
  })

  it('跨月：UTC 10-31 18:00 → 北京 11-01 02:00', () => {
    setServerAnchorFromDateHeader(hdr('2026-10-31T18:00:00Z'), CLIENT_T, CLIENT_T)
    expect(worldMonth(CLIENT_T)).toBe(11)
    expect(worldDay(CLIENT_T)).toBe(1)
    expect(worldYear(CLIENT_T)).toBe(2026)
  })

  it('worldWallClock 的 UTC getter 读出来就是北京墙钟', () => {
    setServerAnchorFromDateHeader(hdr('2026-10-12T04:00:00Z'), CLIENT_T, CLIENT_T)
    const d = worldWallClock(CLIENT_T)
    expect(d.getUTCHours()).toBe(12)
    expect(d.getUTCMonth() + 1).toBe(10)
    expect(d.getUTCDate()).toBe(12)
    expect(d.getUTCFullYear()).toBe(2026)
  })

  it('缺失或非法 Date 头不建立锚点', () => {
    expect(setServerAnchorFromDateHeader(null, CLIENT_T, CLIENT_T)).toBe(false)
    expect(setServerAnchorFromDateHeader(undefined, CLIENT_T, CLIENT_T)).toBe(false)
    expect(setServerAnchorFromDateHeader('not-a-date', CLIENT_T, CLIENT_T)).toBe(false)
    expect(setServerAnchorFromDateHeader('', CLIENT_T, CLIENT_T)).toBe(false)
    expect(hasServerAnchor()).toBe(false)
  })

  it('recordServerClockFrom 可直接从响应对象取头（复用既有请求，零额外请求）', () => {
    const response = {
      headers: {
        get: (name: string) => (name.toLowerCase() === 'date' ? hdr('2026-10-12T04:00:00Z') : null),
      },
    }
    expect(recordServerClockFrom(response, CLIENT_T, CLIENT_T)).toBe(true)
    expect(hasServerAnchor()).toBe(true)
  })
})
