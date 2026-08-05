
<script setup lang="ts">
defineProps<{node:any}>()
</script>
<template>
<div class="building-card">
 <div class="house">🏡</div>
 <div class="name">{{node.name || node.host || 'Farm Node'}}</div>
 <div class="status">🟢 {{node.online===false?'Sleeping':'Working'}}</div>
 <div class="bar"><span :style="{width:(node.cpu||0)+'%'}"></span></div>
 <small>CPU {{node.cpu || 0}}%</small>
</div>
</template>
<style scoped>
.building-card{width:180px;background:#fff0c8;border:5px solid #6b4226;border-radius:12px;padding:12px;text-align:center;box-shadow:6px 6px #3d2411;font-family:monospace}
.house{font-size:38px}.name{font-weight:bold;color:#4b2b12}.status{margin:6px}.bar{height:12px;background:#d8c39a;border:2px solid #6b4226}.bar span{display:block;height:100%;background:#78b159}
</style>
