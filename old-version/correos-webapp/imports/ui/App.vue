<template>
  <div id="app-root" class="min-h-screen bg-gray-50">
    <NavComponent />
    <router-view />
  </div>
</template>

<script setup lang="ts">
import NavComponent from './components/NavComponent.vue'
</script>
