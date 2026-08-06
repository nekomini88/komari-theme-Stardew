import type { Plugin } from 'vite'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

import vueDevTools from 'vite-plugin-vue-devtools'

const require = createRequire(import.meta.url)
const fs = require('node:fs')
const archiver = require('archiver')
const packageJson = require('./package.json')

function getCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  }
  catch {
    return 'unknown'
  }
}

/**
 * Vite 插件：解决 Komari 主题缓存问题
 *
 * Komari 服务器 serve 静态文件时 index.html 无 no-cache 头、图片无内容 hash，
 * 浏览器会一直用旧版缓存（发版后看不到新元素）。
 *
 * 修复（两层）：
 * 1. index.html 注入 <meta http-equiv="Cache-Control" content="no-cache"> +
 *    版本标记 meta —— 浏览器每次加载 HTML 都重新校验
 * 2. 注入缓存清理脚本：HTML 中的 data-theme-version 与 localStorage 上次版本
 *    不一致时，清空静态资源缓存并硬刷新一次（只发生一次，防止死循环）
 */
function cacheBustPlugin(): Plugin {
  return {
    name: 'komari-cache-bust',
    apply: 'build',
    transformIndexHtml(html) {
      const version = packageJson.version || '0.0.0'
      const bustScript = `<script>
(function () {
  var KEY = 'sd-theme-version';
  var cur = ${JSON.stringify(version)};
  try {
    var prev = localStorage.getItem(KEY);
    if (prev !== null && prev !== cur) {
      localStorage.setItem(KEY, cur);
      location.reload(true);
    } else {
      localStorage.setItem(KEY, cur);
    }
  } catch (e) {}
})();
</script>`
      return html
        .replace(
          '<meta name="viewport"',
          '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />\n    <meta http-equiv="Pragma" content="no-cache" />\n    <meta http-equiv="Expires" content="0" />\n    <meta name="viewport"'
        )
        .replace('</head>', bustScript + '\n  </head>')
    },
  }
}

/**
 * Vite 插件：构建后打包 Komari 主题 Zip
 * theme.zip
 * ├── komari-theme.json
 * ├── preview.png
 * └── dist/
 */
function komariThemeZip(): Plugin {
  return {
    name: 'komari-theme-zip',
    apply: 'build',
    closeBundle: async () => {
      const commitHash = getCommitHash()
      const packageJson = require(resolve(__dirname, 'package.json'))
      const version = packageJson.version || '0.0.0'
      const zipFileName = `komari-theme-Komari-Stardew-v${version}-${commitHash}.zip`
      const distDir = resolve(__dirname, 'dist')
      const themeJsonPath = resolve(__dirname, 'komari-theme.json')
      const previewPath = resolve(__dirname, 'preview.png')
      const outputPath = resolve(__dirname, 'release', zipFileName)

      if (!existsSync(distDir)) {
        console.log('[komari-theme-zip] dist directory not found, skipping zip creation')
        return
      }

      const output = fs.createWriteStream(outputPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      return new Promise((resolve, reject) => {
        output.on('close', () => {
          const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2)
          console.log(`[komari-theme-zip] Created ${zipFileName} (${sizeMB} MB)`)
          resolve(undefined)
        })

        archive.on('error', (err: Error) => {
          console.error('[komari-theme-zip] Error:', err)
          reject(err)
        })

        archive.pipe(output)

        if (existsSync(themeJsonPath)) {
          archive.file(themeJsonPath, { name: 'komari-theme.json' })
        }

        if (existsSync(previewPath)) {
          archive.file(previewPath, { name: 'preview.png' })
        }

        archive.directory(distDir, 'dist')

        archive.finalize()
      })
    },
  }
}

export default defineConfig({
  define: {
    __BUILD_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_GIT_HASH__: JSON.stringify(getCommitHash()),
  },
  base: '/',
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    cacheBustPlugin(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'echarts': ['echarts', 'vue-echarts'],
          'reka-ui': ['reka-ui'],
          'vueuse': ['@vueuse/core'],
        },
      },
    },
  },
})
