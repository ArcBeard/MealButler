<script setup lang="ts">
import { CalendarDays } from 'lucide-vue-next'

defineEmits<{
  back: []
}>()
</script>

<template>
  <button
    class="fixed right-0 top-1/2 z-30 -translate-y-1/2 flex items-center justify-center rounded-l-lg bg-primary px-1.5 py-4 text-primary-foreground shadow-lg transition-opacity hover:opacity-90 active:scale-95"
    @click="$emit('back')"
  >
    <div class="flex flex-col items-center gap-1.5">
      <CalendarDays class="size-4" />
      <span class="text-[10px] font-semibold tracking-wide [writing-mode:vertical-lr] rotate-180">Meal Plan</span>
    </div>
  </button>
</template>
