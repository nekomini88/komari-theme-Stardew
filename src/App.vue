<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watchEffect } from 'vue'
import { Toaster } from '@/components/ui/sonner'
import { useAppStore } from '@/stores/app'
import { destroyInitManager, initApp } from '@/utils/init'
import Background from './components/Background.vue'
import Footer from './components/Footer.vue'
import Header from './components/Header.vue'
import LoadingCover from './components/LoadingCover.vue'
import Provider from './components/Provider.vue'

const appStore = useAppStore()

const isReady = ref(false)

watchEffect(() => {
  document.documentElement.classList.toggle('no-glass', !appStore.enableGlassEffect)
})

onMounted(async () => {
  try {
    await initApp()
    await nextTick()
    isReady.value = true
  }
  catch (error) {
    console.error('[App] Initialization failed:', error)
    isReady.value = true
  }
})

onUnmounted(() => {
  destroyInitManager()
})
</script>

<template>
  <Provider>
    <Background />
    <div v-if="appStore.enableGlassEffect" class="glass-orbs" aria-hidden="true">
      <div class="glass-orb glass-orb-1" />
      <div class="glass-orb glass-orb-2" />
      <div class="glass-orb glass-orb-3" />
    </div>
    <Transition
      enter-active-class="transition-all duration-100 ease-out" enter-from-class="opacity-0 backdrop-blur-0"
      enter-to-class="opacity-100 backdrop-blur-sm" leave-active-class="transition-all duration-100 ease-in"
      leave-from-class="opacity-100 backdrop-blur-sm" leave-to-class="opacity-0 backdrop-blur-0"
    >
      <LoadingCover v-if="appStore.loading" />
    </Transition>
    <Header />
    <main v-if="!appStore.loading" class="relative z-10 min-h-screen overflow-hidden">
      <div class="max-w-[1600px] mx-auto">
        <RouterView v-slot="{ Component }">
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 translate-x-4 blur-sm" enter-to-class="opacity-100 translate-x-0 blur-0"
            leave-active-class="transition-all duration-200 ease-in" leave-from-class="opacity-100 translate-x-0 blur-0"
            leave-to-class="opacity-0 -translate-x-4 blur-sm" mode="out-in"
          >
            <KeepAlive :include="['HomeView']">
              <component :is="Component" />
            </KeepAlive>
          </Transition>
        </RouterView>
      </div>
    </main>
    <Footer v-if="!appStore.loading" />
    <Toaster rich-colors close-button position="top-center" />
  </Provider>
</template>

<style>
.glass-orbs {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.glass-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
}

.glass-orb-1 {
  width: 50vw;
  height: 50vh;
  top: -10%;
  left: -5%;
  background: oklch(0.6 0.18 240 / 0.4);
  animation: orb-float-1 18s ease-in-out infinite alternate;
}

.glass-orb-2 {
  width: 40vw;
  height: 45vh;
  bottom: -5%;
  right: -5%;
  background: oklch(0.65 0.15 170 / 0.35);
  animation: orb-float-2 22s ease-in-out infinite alternate;
}

.glass-orb-3 {
  width: 35vw;
  height: 35vh;
  top: 30%;
  left: 40%;
  background: oklch(0.68 0.14 310 / 0.3);
  animation: orb-float-3 25s ease-in-out infinite alternate;
}

.dark .glass-orb-1 {
  background: oklch(0.35 0.1 240 / 0.25);
}

.dark .glass-orb-2 {
  background: oklch(0.3 0.08 200 / 0.2);
}

.dark .glass-orb-3 {
  background: oklch(0.28 0.07 260 / 0.18);
}

@keyframes orb-float-1 {
  0% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(8%, 12%) scale(1.1);
  }
  100% {
    transform: translate(-5%, 8%) scale(0.95);
  }
}

@keyframes orb-float-2 {
  0% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(-10%, -8%) scale(1.08);
  }
  100% {
    transform: translate(5%, -12%) scale(0.98);
  }
}

@keyframes orb-float-3 {
  0% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(12%, -6%) scale(1.05);
  }
  100% {
    transform: translate(-8%, 10%) scale(1.02);
  }
}
</style>
