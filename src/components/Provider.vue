<script setup lang="ts">
import type { VisualStyle } from '@/composables/useVisualStyle'
import type { ThemeMode } from '@/stores/app'
import { useDark } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, provide, ref, watch } from 'vue'
import { BackTop } from '@/components/ui/back-top'
import { useVisualStyle } from '@/composables/useVisualStyle'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const { publicSettings } = storeToRefs(appStore)

const isScrolled = ref(false)
provide('isScrolled', isScrolled)

const themeMode = computed<ThemeMode>({
  get: () => appStore.themeMode,
  set: mode => appStore.updateThemeMode(mode),
})

useDark({
  storageKey: null,
  storageRef: themeMode,
  selector: 'html',
  attribute: 'class',
  valueDark: 'dark',
  valueLight: '',
  initialValue: 'auto',
})

watch(
  () => appStore.isDark,
  (dark) => {
    const root = document.documentElement
    if (dark)
      root.classList.add('dark')
    else
      root.classList.remove('dark')
    root.style.colorScheme = dark ? 'dark' : 'light'
  },
  { immediate: true },
)

watch(
  () => appStore.backgroundEnabled,
  (enabled) => {
    const body = document.body
    if (enabled)
      body.style.setProperty('background-color', 'transparent', 'important')
    else
      body.style.removeProperty('background-color')
  },
  { immediate: true },
)

// Theme selection from theme_settings (color palette)
const themeOverride = ref<string | null>(null)
provide('themeOverride', themeOverride)
provide('setThemeOverride', (value: string | null) => {
  themeOverride.value = value
})
const finalPalette = computed(() => {
  return themeOverride.value ?? (publicSettings.value?.theme_settings?.themeSelection ?? 'emerald')
})
watch(
  () => finalPalette.value,
  (newVal) => {
    const root = document.documentElement
    // Palettes affect styling but do not change visual/mode class except documented palettes.
    if (typeof newVal === 'string' && newVal !== 'emerald') {
      console.log('[Palette] Setting theme to:', newVal)
      root.setAttribute('data-theme', newVal)
    }
    else {
      console.log('[Palette] Resetting to default')
      root.removeAttribute('data-theme')
    }
  },
  { immediate: true },
)

// Visual style persistence: stardew vs baseline
const settingsVisualStyle = computed((): VisualStyle | undefined => publicSettings.value?.theme_settings?.themeVisualStyle as VisualStyle)

onMounted(() => {
  const existing = localStorage.getItem('komaritheme:theme-visual-style-settings')
  if (!existing && settingsVisualStyle.value) {
    localStorage.setItem('komaritheme:theme-visual-style-settings', settingsVisualStyle.value)
  }
})

const { setVisualStyle: setVisualStyleRaw, resetToDefault } = useVisualStyle()
provide('setVisualStyle', setVisualStyleRaw)
provide('resetVisualStyleDefault', resetToDefault)
</script>

<template>
  <slot />
  <BackTop :visibility-height="1" @scrolled="isScrolled = $event" />
</template>
