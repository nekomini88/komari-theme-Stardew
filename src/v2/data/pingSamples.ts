/**
 * 延迟 / 丢包的「格子条」数据 —— 口径对齐参考站 komari.vickypig.com（用户 2026-10-13：
 * 「按照参考站来」）。
 *
 * 参考站实测（DOM）：
 *   - 每个指标格是 `grid-template-columns: repeat(20, minmax(0px, 1fr))` + `gap: 1px`，
 *     **一格一个真实样本**，每格自带 tooltip（不是把数值当百分比去填充）
 *   - 逐格按自身等级上色，色阶为一整套（亮绿 / 绿 / 黄绿 / 红），**无数据的格子是淡色**（opacity 0.15）
 *
 * 我们此前是 `width: min(100, node.latency)%` —— 把「毫秒」直接当「百分比」，
 * 于是 135ms 就顶满格、238ms 和 195ms 看起来一模一样，1% 丢包则几乎全空，语义是错的。
 *
 * 数据来源：`common:getRecords {uuid, type:'ping', hours:1}` —— 实测一小时 180 条
 *（3 个 ping 任务 × 60 条/分钟），每条 `{task_id, time, value(ms), client}`。
 * **某分钟缺记录 = 该分钟丢包**，这正是「丢包格」的着色依据，与参考站 1.0% 丢包 → 19 绿 + 1 红一致。
 */
import { getSharedApi } from '@/utils/api'
import { getSharedRpc } from '@/utils/rpc'

export type SampleLevel = 'ok' | 'warn' | 'crit' | 'none'

export interface PingSample {
  /** ok=健康 / warn=偏慢 / crit=超阈值（丢包格则是「该分钟没数据」）/ none=无数据 */
  level: SampleLevel
  /** 该样本的延迟（ms）；缺样本为 null */
  value: number | null
  /** 该格对应的时间（HH:mm），用于 tooltip */
  at: string
  /** tooltip 文案 */
  title: string
}

export interface PingSeries {
  latency: PingSample[]
  loss: PingSample[]
}

/** 参考站是 20 格，照搬 */
export const SAMPLE_SLOTS = 20
/** 延迟分级阈值（ms）：<100 健康、100~200 偏慢、≥200 超阈值 */
export const LATENCY_WARN_MS = 100
export const LATENCY_CRIT_MS = 200

interface RawRecord {
  task_id: number
  time: string
  value: number
}

export function latencyLevel(ms: unknown): SampleLevel {
  // 注意：不能只靠 Number() 判空 —— Number(null) === 0，会把"无数据"误判成 0ms 的健康值
  if (ms === null || ms === undefined || ms === '')
    return 'none'
  const v = Number(ms)
  if (!Number.isFinite(v) || v < 0)
    return 'none'
  if (v >= LATENCY_CRIT_MS)
    return 'crit'
  if (v >= LATENCY_WARN_MS)
    return 'warn'
  return 'ok'
}

/** '2026-10-13T03:25:00Z' → '03:25'（按服务器给的时间原样截取，不引入本地时区换算） */
export function hhmm(iso: string): string {
  const m = /T(\d{2}:\d{2})/.exec(iso)
  return m?.[1] ?? '--:--'
}

/** 把 ISO 时间裁到分钟精度，用于「槽位对齐」 */
function toMinuteIso(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime()))
    return iso
  d.setUTCSeconds(0, 0)
  return d.toISOString()
}

/**
 * 纯函数：由原始记录 + 任务列表 + 窗口结束时间，构造 20 格序列。
 *
 *  - 只取「主任务」（default_on 的那个，否则第一个）—— 与参考站单条序列的观感一致
 *  - 槽位按任务 interval 从窗口结束时间往回排；**该槽有记录 = 到达，没记录 = 丢包**
 *  - 延迟格：按该样本值分级；缺样本 → none（参考站里无数据格就是淡色）
 *  - 丢包格：到达 → good；缺 → crit（红色），即"这一格丢了"
 */
export function buildPingSeries(
  records: RawRecord[],
  tasks: Array<{ id: number, interval?: number, name?: string, default_on?: boolean }>,
  windowEndIso?: string,
  slots = SAMPLE_SLOTS,
): PingSeries {
  const empty: PingSeries = {
    latency: Array.from({ length: slots }, () => ({ level: 'none' as SampleLevel, value: null, at: '--:--', title: '无数据' })),
    loss: Array.from({ length: slots }, () => ({ level: 'crit' as SampleLevel, value: null, at: '--:--', title: '无数据' })),
  }
  if (!records.length)
    return empty

  const primary = tasks.find(t => t.default_on) ?? tasks[0]
  const rows = (primary ? records.filter(r => r.task_id === primary.id) : records)
    .slice()
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  if (!rows.length) {
    // 有记录但都不是主任务的 → 退化成"所有任务混在一起"，仍按时间排序取序列
    rows.push(...records.slice().sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()))
  }

  const intervalMs = Math.max(1, Number(primary?.interval) || 60) * 1000
  const endMs = windowEndIso && !Number.isNaN(new Date(windowEndIso).getTime())
    ? new Date(toMinuteIso(windowEndIso)).getTime()
    // rows 非空（上面已判过），此处取最后一条样本所在分钟
    : new Date(toMinuteIso(rows[rows.length - 1]!.time)).getTime()

  const byTime = new Map<string, RawRecord>()
  for (const r of rows)
    byTime.set(toMinuteIso(r.time), r)

  const latency: PingSample[] = []
  const loss: PingSample[] = []
  for (let i = slots - 1; i >= 0; i--) {
    const slotIso = new Date(endMs - i * intervalMs).toISOString()
    const hit = byTime.get(slotIso)
    const at = hhmm(slotIso)
    // 实测发现：komari 对 ping 失败的那一分钟**仍写一条记录，但 value = -1**
    //（de-rabisu 61 条样本里有 1 条 -1，任务 loss 字段正好 1.639% = 1/61）。
    // 所以「有记录」不等于「到达」——负值/非法值同样是丢包，否则丢包格会假绿。
    const arrived = !!hit && Number.isFinite(Number(hit!.value)) && Number(hit!.value) >= 0
    if (arrived) {
      const v = Number(hit!.value)
      latency.push({ level: latencyLevel(v), value: v, at, title: `${at} · ${Math.round(v)} ms` })
      loss.push({ level: 'ok', value: v, at, title: `${at} · 到达 ${Math.round(v)} ms` })
    }
    else {
      latency.push({
        level: 'none',
        value: null,
        at,
        title: hit ? `${at} · ping 失败（丢包）` : `${at} · 无数据`,
      })
      loss.push({ level: 'crit', value: null, at, title: hit ? `${at} · ping 失败` : `${at} · 丢包` })
    }
  }
  return { latency, loss }
}

// ==================== 取数（带 60s 缓存，同一节点不重复打接口） ====================

const cache = new Map<string, { at: number, series: PingSeries }>()
const TTL = 60_000

/**
 * 取 ping 记录：**先走 HTTP API**（`/records/ping`，与节点数据同一条通道，最稳），
 * RPC 作兜底。
 *
 * 踩过的坑：先前只用 `getSharedRpc()`，而本实例的 RPC health check 返回 404
 *（`Backend service unavailable`）→ 客户端未就绪、调用抛错 → 被 catch 吞掉后
 * 静默返回空序列，于是整条格子条变成"全无数据"。**原样照搬主题详情页的取数方式会翻车。**
 */
async function fetchRecords(uuid: string, hours: number): Promise<any | null> {
  try {
    const viaHttp = await getSharedApi().getPingRecords(uuid, hours)
    if (viaHttp && Array.isArray((viaHttp as any).records) && (viaHttp as any).records.length)
      return viaHttp
  }
  catch {
    // 落到 RPC 兜底
  }
  try {
    return await getSharedRpc().getClient().call<any>('common:getRecords', { uuid, type: 'ping', hours })
  }
  catch {
    return null
  }
}

export async function loadPingSeries(uuid: string, hours = 1): Promise<PingSeries> {
  if (!uuid)
    return buildPingSeries([], [])
  const cached = cache.get(uuid)
  if (cached && Date.now() - cached.at < TTL)
    return cached.series

  const res = await fetchRecords(uuid, hours)
  // 取不到就返回空序列（全淡色），不影响卡片其它部分
  const series = buildPingSeries(res?.records ?? [], res?.tasks ?? [], res?.to)
  if (res)
    cache.set(uuid, { at: Date.now(), series })
  return series
}

/** 测试用：清缓存 */
export function clearPingSeriesCache(): void {
  cache.clear()
}
