<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import AppNavigation from '@/components/AppNavigation.vue'
</script>

<template>
  <div class="min-h-screen bg-background">
    <AppHeader />
    <AppNavigation />
    <main class="p-4">
      <RouterView />
    </main>
  </div>
</template>
