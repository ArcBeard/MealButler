<script setup lang="ts">
defineProps<{
  progress: number
  label: string
}>()
</script>

<template>
  <div class="px-1">
    <div class="mb-1 flex items-center justify-between text-xs text-muted-foreground">
      <span>{{ label }}</span>
      <span>{{ progress }}%</span>
    </div>
    <div class="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div
        class="h-full rounded-full bg-primary transition-all duration-500 ease-out"
        :style="{ width: `${progress}%` }"
      />
    </div>
  </div>
</template>
