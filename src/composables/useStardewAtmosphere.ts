import { computed, onMounted, onUnmounted, ref } from 'vue'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

const now = new Date()
const month = now.getMonth() + 1
const seasonMap: Record<number, Season> = { 3: 'spring', 4: 'spring', 5: 'spring', 6: 'summer', 7: 'summer', 8: 'summer', 9: 'autumn', 10: 'autumn', 11: 'autumn', 12: 'winter', 1: 'winter', 2: 'winter' }
const defaultSeason = seasonMap[month] ?? 'spring'

export const season = ref<Season>(defaultSeason)
export const weather = ref<'clear' | 'rain' | 'snow' | 'thunder' | 'fog'>('clear')
export const isNight = ref(false)
export const isThunder = ref(false)

let ticker: number | null = null
function update() {
  const hour = new Date().getHours()
  isNight.value = hour < 6 || hour >= 18
  isThunder.value = weather.value === 'thunder'
}

function setup() {
  update()
  ticker = window.setInterval(update, 60000)
}

function teardown() {
  if (ticker !== null) {
    clearInterval(ticker)
    ticker = null
  }
}

onMounted(setup)
onUnmounted(teardown)

const seasonWeatherPool: Record<Season, string[]> = {
  spring: ['clear', 'rain', 'fog'],
  summer: ['clear', 'rain', 'thunder'],
  autumn: ['clear', 'rain', 'fog'],
  winter: ['clear', 'snow', 'thunder', 'fog'],
}
export const weatherPool = computed(() => seasonWeatherPool[season.value])
export const isRain = computed(() => weather.value === 'rain')
export const isSnow = computed(() => weather.value === 'snow')
export const isFog = computed(() => weather.value === 'fog')

export function setWeather(next: 'clear' | 'rain' | 'snow' | 'thunder' | 'fog') {
  weather.value = next
}
