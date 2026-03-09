<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Clock, Flame, ExternalLink, Users } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import RecipeIngredients from '@/components/recipe/RecipeIngredients.vue'
import RecipeSteps from '@/components/recipe/RecipeSteps.vue'
import FavoriteButton from '@/components/recipe/FavoriteButton.vue'
import { useMealPlanStore } from '@/stores/mealPlan'
import type { MealType } from '@/types/meals'

const route = useRoute()
const router = useRouter()
const mealPlanStore = useMealPlanStore()

const weekStart = computed(() => route.params.weekStart as string)
const dayIndex = computed(() => Number(route.params.dayIndex))
const mealType = computed(() => route.params.mealType as MealType)

const meal = computed(() => {
  const plan = mealPlanStore.weekPlans[weekStart.value]
  if (!plan) return null
  const day = plan[dayIndex.value]
  if (!day) return null
  return day.meals[mealType.value] ?? null
})

const recipe = computed(() => meal.value?.recipe ?? null)
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <!-- Back button -->
    <Button variant="ghost" size="sm" class="mb-4" @click="router.back()">
      <ArrowLeft class="mr-2 size-4" />
      Back
    </Button>

    <template v-if="meal && recipe">
      <!-- Hero image -->
      <div class="relative mb-6 overflow-hidden rounded-xl">
        <img
          v-if="recipe.imageUrl"
          :src="recipe.imageUrl"
          :alt="recipe.title"
          class="h-56 w-full object-cover"
        />
        <div
          v-else
          class="flex h-56 w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5"
        >
          <span class="text-6xl">{{ meal.emoji }}</span>
        </div>
      </div>

      <!-- Title & source -->
      <div class="mb-4 flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <h1 class="text-2xl font-bold">{{ recipe.title }}</h1>
          <a
            v-if="recipe.sourceUrl && recipe.sourceName"
            :href="recipe.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {{ recipe.sourceName }}
            <ExternalLink class="size-3" />
          </a>
        </div>
        <FavoriteButton :recipe="recipe" />
      </div>

      <!-- Time badges -->
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <Badge v-if="recipe.prepMinutes" variant="secondary">
          <Clock class="mr-1 size-3" />
          {{ recipe.prepMinutes }} min prep
        </Badge>
        <Badge v-if="recipe.cookMinutes" variant="secondary">
          <Clock class="mr-1 size-3" />
          {{ recipe.cookMinutes }} min cook
        </Badge>
        <Badge v-if="recipe.readyInMinutes" variant="outline">
          {{ recipe.readyInMinutes }} min total
        </Badge>
      </div>

      <!-- Servings & calories -->
      <div class="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span class="flex items-center gap-1">
          <Users class="size-4" />
          {{ recipe.servings }} servings
        </span>
        <span v-if="meal.calories" class="flex items-center gap-1">
          <Flame class="size-4" />
          {{ meal.calories }} cal
        </span>
      </div>

      <!-- Cuisine badges -->
      <div v-if="recipe.cuisines.length > 0" class="mb-4 flex flex-wrap gap-2">
        <Badge v-for="cuisine in recipe.cuisines" :key="cuisine" variant="outline">
          {{ cuisine }}
        </Badge>
      </div>

      <Separator class="my-6" />

      <!-- Ingredients -->
      <Card v-if="recipe.ingredients.length > 0" class="mb-6">
        <CardHeader>
          <CardTitle class="text-base">Ingredients</CardTitle>
        </CardHeader>
        <CardContent>
          <RecipeIngredients :ingredients="recipe.ingredients" />
        </CardContent>
      </Card>

      <!-- Steps -->
      <Card v-if="recipe.steps.length > 0" class="mb-6">
        <CardHeader>
          <CardTitle class="text-base">Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <RecipeSteps :steps="recipe.steps" />
        </CardContent>
      </Card>

      <!-- View Original Recipe link -->
      <div v-if="recipe.sourceUrl" class="mb-8 text-center">
        <Button as="a" :href="recipe.sourceUrl" target="_blank" rel="noopener noreferrer" variant="outline">
          <ExternalLink class="mr-2 size-4" />
          View Original Recipe
        </Button>
      </div>
    </template>

    <!-- Meal without recipe data -->
    <template v-else-if="meal">
      <div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span class="text-6xl">{{ meal.emoji }}</span>
        <h2 class="text-xl font-semibold">{{ meal.name }}</h2>
        <p class="text-sm text-muted-foreground">Recipe details not available</p>
      </div>
    </template>

    <!-- No meal found -->
    <template v-else>
      <div class="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
        <p class="text-sm">Meal not found.</p>
        <Button variant="outline" size="sm" @click="router.back()">Go back</Button>
      </div>
    </template>
  </div>
</template>
