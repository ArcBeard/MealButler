<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { Clock, Heart } from 'lucide-vue-next'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useMealPlanStore } from '@/stores/mealPlan'
import { useFavoritesStore } from '@/stores/favorites'
import type { Recipe, MealType } from '@/types/meals'

const mealPlanStore = useMealPlanStore()
const favoritesStore = useFavoritesStore()

onMounted(() => {
  favoritesStore.fetchFavorites()
})

// Get current week's Monday
const currentMonday = computed(() => {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const d = new Date(now)
  d.setDate(diff)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
})

// Favorites as array
const favoritesList = computed(() => Array.from(favoritesStore.favorites.values()))

// Unique recipes from current week's meal plan with route info
interface MealPlanRecipeEntry {
  recipe: Recipe
  mealName: string
  emoji: string
  prepMinutes: number
  weekStart: string
  dayIndex: number
  mealType: MealType
}

const mealPlanRecipes = computed<MealPlanRecipeEntry[]>(() => {
  const weekStart = currentMonday.value
  const plan = mealPlanStore.weekPlans[weekStart]
  if (!plan) return []

  const seen = new Set<string>()
  const entries: MealPlanRecipeEntry[] = []
  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

  plan.forEach((day, dayIndex) => {
    for (const type of mealTypes) {
      const meal = day.meals[type]
      if (!meal?.recipe) continue
      if (seen.has(meal.recipe.recipeId)) continue
      seen.add(meal.recipe.recipeId)
      entries.push({
        recipe: meal.recipe,
        mealName: meal.name,
        emoji: meal.emoji,
        prepMinutes: meal.prepMinutes,
        weekStart,
        dayIndex,
        mealType: type,
      })
    }
  })

  return entries
})
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <h1 class="text-2xl font-bold">Recipes</h1>
    <p class="mt-1 text-sm text-muted-foreground">Your saved favorites and this week's meals</p>

    <!-- Favorites Section -->
    <section class="mt-8">
      <div class="mb-3 flex items-center gap-2">
        <Heart class="size-5 text-red-500" />
        <h2 class="text-lg font-semibold">Favorites</h2>
      </div>

      <div v-if="favoritesList.length === 0" class="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
        <p class="text-sm text-muted-foreground">No favorite recipes yet.</p>
        <p class="mt-1 text-xs text-muted-foreground">Tap the heart icon on a recipe to save it here.</p>
      </div>

      <div v-else class="grid grid-cols-2 gap-3">
        <Card v-for="fav in favoritesList" :key="fav.recipeId" class="overflow-hidden transition-shadow hover:shadow-md">
          <div class="relative">
            <img
              v-if="fav.imageUrl"
              :src="fav.imageUrl"
              :alt="fav.title"
              class="h-28 w-full object-cover"
            />
            <div
              v-else
              class="flex h-28 w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5"
            >
              <Heart class="size-8 fill-red-500 text-red-500" />
            </div>
          </div>
          <CardContent class="p-3">
            <p class="truncate text-sm font-medium">{{ fav.title }}</p>
            <div v-if="fav.cuisines.length > 0" class="mt-1.5 flex flex-wrap gap-1">
              <Badge v-for="cuisine in fav.cuisines.slice(0, 2)" :key="cuisine" variant="outline" class="text-[10px]">
                {{ cuisine }}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>

    <!-- Meal Plan Recipes Section -->
    <section class="mt-8">
      <h2 class="mb-3 text-lg font-semibold">From Your Meal Plan</h2>

      <div v-if="mealPlanRecipes.length === 0" class="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
        <p class="text-sm text-muted-foreground">No recipes in your meal plan this week.</p>
        <p class="mt-1 text-xs text-muted-foreground">Chat with Jeeves to generate a meal plan!</p>
      </div>

      <div v-else class="grid grid-cols-2 gap-3">
        <RouterLink
          v-for="entry in mealPlanRecipes"
          :key="entry.recipe.recipeId"
          :to="`/recipe/${entry.weekStart}/${entry.dayIndex}/${entry.mealType}`"
          class="block"
        >
          <Card class="overflow-hidden transition-shadow hover:shadow-md">
            <div class="relative">
              <img
                v-if="entry.recipe.imageUrl"
                :src="entry.recipe.imageUrl"
                :alt="entry.recipe.title"
                class="h-28 w-full object-cover"
              />
              <div
                v-else
                class="flex h-28 w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5"
              >
                <span class="text-4xl">{{ entry.emoji }}</span>
              </div>
            </div>
            <CardContent class="p-3">
              <p class="truncate text-sm font-medium">{{ entry.recipe.title }}</p>
              <div class="mt-1.5 flex items-center gap-2">
                <div v-if="entry.recipe.cuisines.length > 0" class="flex flex-wrap gap-1">
                  <Badge v-for="cuisine in entry.recipe.cuisines.slice(0, 2)" :key="cuisine" variant="outline" class="text-[10px]">
                    {{ cuisine }}
                  </Badge>
                </div>
                <span v-if="entry.prepMinutes" class="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Clock class="size-3" />
                  {{ entry.prepMinutes }}m
                </span>
              </div>
            </CardContent>
          </Card>
        </RouterLink>
      </div>
    </section>
  </div>
</template>
