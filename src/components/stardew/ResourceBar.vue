<script setup lang="ts">
defineProps<{icon:string,label:string,value:number}>()
</script>
<template>
<div class="resource-bar">
  <div>{{icon}} {{label}}</div>
  <div class="resource-track"><div class="resource-fill" :style="{width: Math.min(value,100)+'%'}"></div></div>
</div>
</template>
