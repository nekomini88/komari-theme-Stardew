import { computed, ref } from 'vue'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type Weather = 'clear' | 'rain' | 'snow' | 'thunder' | 'fog'
export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night'

const seasonMap: Record<number, Season> = {
  1: 'winter',
  2: 'winter',
  3: 'spring',
  4: 'spring',
  5: 'spring',
  6: 'summer',
  7: 'summer',
  8: 'summer',
  9: 'autumn',
  10: 'autumn',
  11: 'autumn',
  12: 'winter',
}

function monthToSeason(month: number): Season {
  return seasonMap[month] ?? 'spring'
}

function hourToTimeOfDay(hour: number, minute: number): TimeOfDay {
  const t = hour + minute / 60
  if (t >= 5 && t < 7)
    return 'dawn'
  if (t >= 7 && t < 17)
    return 'day'
  if (t >= 17 && t < 19.5)
    return 'dusk'
  return 'night'
}

/** Sun arc: 0 at left horizon (dawn), 0.5 at zenith (noon), 1 at right horizon (dusk) */
function sunProgress(hour: number, minute: number): number {
  const t = hour + minute / 60
  const start = 5
  const end = 19.5
  if (t <= start || t >= end)
    return t < 12 ? 0 : 1
  return (t - start) / (end - start)
}

const seasonWeatherPool: Record<Season, Weather[]> = {
  spring: ['clear', 'clear', 'rain', 'fog', 'clear'],
  summer: ['clear', 'clear', 'rain', 'thunder', 'clear'],
  autumn: ['clear', 'rain', 'fog', 'clear', 'clear'],
  winter: ['clear', 'snow', 'snow', 'fog', 'clear'],
}

export const season = ref<Season>(monthToSeason(new Date().getMonth() + 1))
export const weather = ref<Weather>('clear')
export const timeOfDay = ref<TimeOfDay>('day')
export const isNight = ref(false)
export const isThunder = ref(false)
export const sunX = ref(50)
export const sunY = ref(18)
export const moonX = ref(72)
export const moonY = ref(14)
export const hourFraction = ref(12)

export const isRain = computed(() => weather.value === 'rain' || weather.value === 'thunder')
export const isSnow = computed(() => weather.value === 'snow')
export const isFog = computed(() => weather.value === 'fog')
export const weatherPool = computed(() => seasonWeatherPool[season.value])

let ticker: number | null = null
let weatherTicker: number | null = null
let started = false

function applyDocumentAttrs() {
  if (typeof document === 'undefined')
    return
  const root = document.documentElement
  root.setAttribute('data-season', season.value)
  root.setAttribute('data-weather', weather.value)
  root.setAttribute('data-time', timeOfDay.value)
  root.classList.toggle('is-night', isNight.value)
  root.classList.toggle('is-rain', isRain.value)
  root.classList.toggle('is-snow', isSnow.value)
  root.classList.toggle('is-fog', isFog.value)
  root.classList.toggle('is-thunder', weather.value === 'thunder')
}

function updateClock() {
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const tod = hourToTimeOfDay(hour, minute)
  timeOfDay.value = tod
  isNight.value = tod === 'night'
  hourFraction.value = hour + minute / 60

  const progress = sunProgress(hour, minute)
  sunX.value = 8 + progress * 84
  sunY.value = 42 - Math.sin(progress * Math.PI) * 32
  moonX.value = 75 - progress * 20
  moonY.value = 12 + Math.sin((1 - progress) * Math.PI) * 8

  const nextSeason = monthToSeason(now.getMonth() + 1)
  if (nextSeason !== season.value)
    season.value = nextSeason

  isThunder.value = weather.value === 'thunder'
  applyDocumentAttrs()
}

function pickWeather() {
  const pool = seasonWeatherPool[season.value]
  const next = pool[Math.floor(Math.random() * pool.length)] ?? 'clear'
  weather.value = next
  isThunder.value = next === 'thunder'
  applyDocumentAttrs()
}

export function setWeather(next: Weather) {
  weather.value = next
  isThunder.value = next === 'thunder'
  applyDocumentAttrs()
}

export function setSeason(next: Season) {
  season.value = next
  applyDocumentAttrs()
}

/** Call once from App onMounted */
export function startAtmosphere() {
  if (started)
    return
  started = true
  updateClock()
  pickWeather()
  ticker = window.setInterval(updateClock, 30_000)
  const weatherMs = 8 * 60_000 + Math.random() * 6 * 60_000
  weatherTicker = window.setInterval(pickWeather, weatherMs)
}

export function stopAtmosphere() {
  started = false
  if (ticker !== null) {
    clearInterval(ticker)
    ticker = null
  }
  if (weatherTicker !== null) {
    clearInterval(weatherTicker)
    weatherTicker = null
  }
}

/** Sky / grass palettes aligned with PDF mockups */
export const skyGradients: Record<Season, Record<TimeOfDay, string>> = {
  spring: {
    dawn: 'linear-gradient(180deg, #f7c9a8 0%, #ffd6b0 25%, #b8e0f0 55%, #c8e8c0 100%)',
    day: 'linear-gradient(180deg, #87CEEB 0%, #B0E0E6 28%, #d5f5e3 65%, #e8f5e9 100%)',
    dusk: 'linear-gradient(180deg, #f4a261 0%, #e76f51 28%, #f4d35e 55%, #2a9d8f 100%)',
    night: 'linear-gradient(180deg, #0b1b3a 0%, #1c2f57 35%, #2c3e63 70%, #16314f 100%)',
  },
  summer: {
    dawn: 'linear-gradient(180deg, #ffb347 0%, #ffcc80 30%, #81d4fa 60%, #a5d6a7 100%)',
    day: 'linear-gradient(180deg, #5DADE2 0%, #85C1E9 22%, #aed6f1 55%, #d5f5e3 100%)',
    dusk: 'linear-gradient(180deg, #ff8c42 0%, #ff6b35 30%, #f7c948 55%, #2d6a4f 100%)',
    night: 'linear-gradient(180deg, #0a1628 0%, #152238 40%, #1b3a4b 75%, #0d2818 100%)',
  },
  autumn: {
    dawn: 'linear-gradient(180deg, #f4a261 0%, #e9c46a 30%, #b8d4e8 60%, #c9a66b 100%)',
    day: 'linear-gradient(180deg, #f4d03f 0%, #f8c471 25%, #f5b041 55%, #fad7a0 100%)',
    dusk: 'linear-gradient(180deg, #c0392b 0%, #e67e22 30%, #f39c12 55%, #6d4c1d 100%)',
    night: 'linear-gradient(180deg, #1a0f0a 0%, #2c1810 40%, #3d2314 75%, #1f1208 100%)',
  },
  winter: {
    dawn: 'linear-gradient(180deg, #a8c0d8 0%, #c5d5e8 30%, #e8eef5 60%, #f0f4f8 100%)',
    day: 'linear-gradient(180deg, #d5dbdb 0%, #d6eaf8 28%, #eaf2f8 60%, #f8f9f9 100%)',
    dusk: 'linear-gradient(180deg, #7b8fa1 0%, #9bb0c4 30%, #c8d6e5 60%, #e8eef5 100%)',
    night: 'linear-gradient(180deg, #0d1520 0%, #1a2535 40%, #243447 75%, #15202b 100%)',
  },
}

export const grassGradients: Record<Season, { back: string, front: string }> = {
  spring: {
    back: 'linear-gradient(180deg, #8bc34a 0%, #689f38 45%, #33691e 100%)',
    front: 'linear-gradient(180deg, #4f9e2a 0%, #357018 100%)',
  },
  summer: {
    back: 'linear-gradient(180deg, #7cb342 0%, #558b2f 45%, #1b5e20 100%)',
    front: 'linear-gradient(180deg, #2e8b57 0%, #166534 100%)',
  },
  autumn: {
    back: 'linear-gradient(180deg, #d4a017 0%, #b8860b 45%, #6d4c1d 100%)',
    front: 'linear-gradient(180deg, #cd853f 0%, #8b4513 100%)',
  },
  winter: {
    back: 'linear-gradient(180deg, #e8eef2 0%, #cfd8dc 45%, #90a4ae 100%)',
    front: 'linear-gradient(180deg, #d3d3d3 0%, #a9a9a9 100%)',
  },
}
