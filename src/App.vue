<script setup lang="ts">
import { ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import AppNavigation from '@/components/AppNavigation.vue'

const navOpen = ref(false)
</script>

<template>
  <div class="min-h-screen bg-background">
    <AppHeader @toggle-nav="navOpen = !navOpen" />
    <AppNavigation v-model:open="navOpen" />
    <main class="p-4">
      <RouterView />
    </main>
  </div>
</template>
