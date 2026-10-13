<script setup lang="ts">
/** v2 页脚 */
const version = __BUILD_VERSION__
const hash = __BUILD_GIT_HASH__
</script>

<template>
  <footer class="vk-footer">
    NekoVPS v2 · M1 设计系统与场景骨架 · v{{ version }} ({{ hash }})
  </footer>
</template>
