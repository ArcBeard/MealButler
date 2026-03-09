<script setup lang="ts">
import { computed } from 'vue'
import { Heart } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useFavoritesStore } from '@/stores/favorites'
import type { Recipe } from '@/types/meals'

const props = defineProps<{
  recipe: Recipe
}>()

const favoritesStore = useFavoritesStore()

const favorited = computed(() => favoritesStore.isFavorite(props.recipe.spoonacularId))

function toggle() {
  favoritesStore.toggleFavorite(props.recipe)
}
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    class="rounded-full"
    :aria-label="favorited ? 'Remove from favorites' : 'Add to favorites'"
    @click="toggle"
  >
    <Heart
      class="size-5 transition-colors"
      :class="favorited ? 'fill-red-500 text-red-500' : 'text-muted-foreground'"
    />
  </Button>
</template>
