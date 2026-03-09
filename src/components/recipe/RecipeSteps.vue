<script setup lang="ts">
import type { RecipeStep } from '@/types/meals'

defineProps<{
  steps: RecipeStep[]
}>()
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="step in steps"
      :key="step.number"
      class="flex gap-4"
    >
      <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {{ step.number }}
      </div>
      <p class="pt-1 text-sm leading-relaxed">{{ step.step }}</p>
    </div>
  </div>
</template>
