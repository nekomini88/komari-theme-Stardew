<script setup lang="ts">
defineProps<{online:boolean}>()
</script>
<template><div class="status-badge">{{online ? '🟢 FARM ACTIVE' : '💤 SLEEPING'}}</div></template>
