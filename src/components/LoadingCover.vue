<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const isDark = computed(() => appStore.isDark)
</script>

<template>
  <div
    class="loading-cover flex items-center inset-0 justify-center fixed z-20"
    :class="isDark ? 'bg-black/70' : 'bg-[#fbecc8]'"
  >
    <div class="flex flex-col items-center gap-3">
      <div class="loading-sprite" :class="isDark ? 'loading-sprite-dark' : 'loading-sprite-light'" />
      <span class="text-sm tracking-widest" :class="isDark ? 'text-[#dcc083]' : 'text-[#6e4220]'">LOADING</span>
    </div>
  </div>
</template>

<style scoped>
.loading-sprite {
  width: 120px;
  height: 120px;
  background: url('/images/loading.svg') center/contain no-repeat;
  image-rendering: pixelated;
  animation: loading-bob 1.8s ease-in-out infinite;
}
.loading-sprite-light {
  filter: drop-shadow(0 0 0 transparent);
}
.loading-sprite-dark {
  filter: drop-shadow(0 0 6px rgba(220, 170, 60, 0.35));
}

@keyframes loading-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
</style>
