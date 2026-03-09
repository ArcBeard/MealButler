<script setup lang="ts">
import { ref } from 'vue'
import { Checkbox } from '@/components/ui/checkbox'
import type { Ingredient } from '@/types/meals'

defineProps<{
  ingredients: Ingredient[]
}>()

const checkedItems = ref<Set<number>>(new Set())

function toggleItem(id: number) {
  if (checkedItems.value.has(id)) {
    checkedItems.value.delete(id)
  } else {
    checkedItems.value.add(id)
  }
  checkedItems.value = new Set(checkedItems.value)
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="ingredient in ingredients"
      :key="ingredient.id"
      class="flex items-center gap-3"
    >
      <Checkbox
        :checked="checkedItems.has(ingredient.id)"
        @update:checked="toggleItem(ingredient.id)"
      />
      <span
        class="text-sm transition-all"
        :class="checkedItems.has(ingredient.id) ? 'line-through text-muted-foreground' : ''"
      >
        {{ ingredient.original }}
      </span>
    </div>
  </div>
</template>
