<script setup lang="ts">
import { ref } from 'vue'
import { Clock, ExternalLink, Users, Flame, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import RecipeIngredients from '@/components/recipe/RecipeIngredients.vue'
import RecipeSteps from '@/components/recipe/RecipeSteps.vue'
import FavoriteButton from '@/components/recipe/FavoriteButton.vue'
import type { Meal, Recipe } from '@/types/meals'

const props = defineProps<{
  meal: Meal
  recipe: Recipe
}>()

const activeTab = ref<'overview' | 'steps'>('overview')
const currentStep = ref(0)

function prevStep() {
  if (currentStep.value > 0) currentStep.value--
}

function nextStep() {
  if (currentStep.value < props.recipe.steps.length - 1) currentStep.value++
}
</script>

<template>
  <div class="mx-auto max-w-2xl pr-8">
    <!-- Tab Toggle -->
    <div class="mb-4 flex justify-center">
      <div class="inline-flex rounded-lg border border-border p-0.5">
        <Button
          :variant="activeTab === 'overview' ? 'default' : 'ghost'"
          size="sm"
          class="rounded-md"
          @click="activeTab = 'overview'"
        >
          Overview
        </Button>
        <Button
          :variant="activeTab === 'steps' ? 'default' : 'ghost'"
          size="sm"
          class="rounded-md"
          @click="activeTab = 'steps'"
        >
          Steps
        </Button>
      </div>
    </div>

    <!-- Overview Tab -->
    <template v-if="activeTab === 'overview'">
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

    <!-- Steps Tab -->
    <template v-else>
      <div v-if="recipe.steps.length > 0" class="flex flex-col gap-6 py-4">
        <!-- Step counter -->
        <p class="text-center text-sm font-medium text-muted-foreground">
          Step {{ currentStep + 1 }} of {{ recipe.steps.length }}
        </p>

        <!-- Progress bar -->
        <Progress :model-value="((currentStep + 1) / recipe.steps.length) * 100" class="h-2" />

        <!-- Step text -->
        <div class="min-h-[40vh] flex items-center justify-center px-2">
          <p class="text-center text-lg leading-relaxed">
            {{ recipe.steps[currentStep]!.step }}
          </p>
        </div>

        <!-- Prev / Next -->
        <div class="flex items-center justify-between">
          <Button
            variant="outline"
            :disabled="currentStep === 0"
            @click="prevStep"
          >
            <ChevronLeft class="mr-1 size-4" />
            Prev
          </Button>
          <Button
            :disabled="currentStep === recipe.steps.length - 1"
            @click="nextStep"
          >
            Next
            <ChevronRight class="ml-1 size-4" />
          </Button>
        </div>
      </div>

      <div v-else class="flex items-center justify-center py-16 text-sm text-muted-foreground">
        No steps available for this recipe.
      </div>
    </template>
  </div>
</template>
