/**
 * 天气层状态（纯逻辑，无副作用 → 可单测）
 *
 * 目标：按访客 IP 取当地当前天气，在场景上叠加轻量天气效果（雨/雪/雾等）。
 *
 * 约束（任务硬要求）：
 *  - 取 IP / 取天气失败、无网络、超时 → 一律优雅退化为 'clear'，绝不抛错、绝不阻塞页面。
 *  - 只用原生 fetch；本模块不引入任何新依赖。
 *  - 天气类型是有限枚举，供 CSS 层 [data-weather] 选择器消费。
 */

/** 支持的天气类型（与 scene.css 的 [data-weather] 选择器一一对应） */
export type WeatherType = 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'thunder'

/** 所有天气类型（用于 URL 参数校验） */
export const WEATHER_TYPES: readonly WeatherType[] = [
  'clear',
  'cloudy',
  'rain',
  'snow',
  'fog',
  'thunder',
] as const

/** 兜底天气：任何失败路径都回到它 */
export const WEATHER_FALLBACK: WeatherType = 'clear'

/** 访客天气取数超时（ms），超时即退化，不阻塞首屏 */
export const WEATHER_TIMEOUT_MS = 5000

/**
 * WMO 天气代码（Open-Meteo / WMO 4677）→ 场景天气类型。
 * 未知代码一律回退 'clear'（优雅退化）。
 */
export function mapWmoCode(code: number | null | undefined): WeatherType {
  if (typeof code !== 'number' || Number.isNaN(code))
    return WEATHER_FALLBACK
  if (code === 0)
    return 'clear'
  if (code >= 1 && code <= 3)
    return 'cloudy'
  if (code === 45 || code === 48)
    return 'fog'
  // 毛毛雨 / 雨 / 阵雨 / 冻雨
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
    return 'rain'
  // 雪 / 阵雪
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return 'snow'
  // 雷暴（含冰雹）
  if (code >= 95 && code <= 99)
    return 'thunder'
  return WEATHER_FALLBACK
}

/**
 * URL 参数覆盖（仅用于预览/截图）：`?weather=rain`。
 * 非法值返回 null（调用方沿用按 IP 取数或兜底）。
 */
export function parseWeatherParam(value: string | null | undefined): WeatherType | null {
  if (!value)
    return null
  const v = value.toLowerCase()
  return (WEATHER_TYPES as readonly string[]).includes(v) ? (v as WeatherType) : null
}

/** 带超时的原生 fetch + JSON 解析；任何失败返回 null（不抛错） */
async function fetchJson(url: string, timeoutMs: number): Promise<any | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok)
      return null
    return await res.json()
  }
  catch {
    return null
  }
}

/**
 * 按访客 IP 取当地当前天气。
 *
 * 步骤：ipwho.is 定位（lat/lng）→ open-meteo 当前天气（weather_code）。
 * 任何一步失败、超时、返回异常 → 返回 'clear'。永不抛错。
 */
export async function fetchVisitorWeather(options?: {
  /** 注入取数实现（测试用）；默认走带超时的原生 fetch */
  fetchJsonImpl?: (url: string, timeoutMs: number) => Promise<any | null>
  timeoutMs?: number
}): Promise<WeatherType> {
  const get = options?.fetchJsonImpl ?? fetchJson
  const timeoutMs = options?.timeoutMs ?? WEATHER_TIMEOUT_MS
  try {
    const geo = await get('https://ipwho.is/', timeoutMs)
    const lat = geo?.latitude
    const lng = geo?.longitude
    if (geo?.success === false || typeof lat !== 'number' || typeof lng !== 'number')
      return WEATHER_FALLBACK
    const weather = await get(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=weather_code`,
      timeoutMs,
    )
    return mapWmoCode(weather?.current?.weather_code)
  }
  catch {
    return WEATHER_FALLBACK
  }
}
