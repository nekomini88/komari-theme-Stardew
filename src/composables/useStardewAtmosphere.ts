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
