import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { setupIconify } from '@/utils/iconify'
import { message } from '@/utils/message'
import App from './App.vue'
import router from './router'

import './styles/main.css'

// Stardew-2: force data-theme before any render to avoid flash and ensure theme loads.
;(function() {
  try {
    var KEY = 'komaritheme:theme'
    var KEY_DEFAULT = 'komaritheme:theme-default'
    var ALLOWED = ['stardew', 'baseline']
    function parse(raw: string | null) {
      if (!raw) return 'stardew'
      var v = raw.trim()
      return ALLOWED.indexOf(v) !== -1 ? v : 'stardew'
    }
    var saved = parse(localStorage.getItem(KEY))
    var fallback = parse(localStorage.getItem(KEY_DEFAULT))
    document.documentElement.setAttribute('data-theme', saved || fallback || 'stardew')
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'stardew')
  }
})()

window.$message = message

setupIconify().catch((err) => {
  console.warn('[main] iconify init failed', err)
})

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(router)

app.mount('#app')
