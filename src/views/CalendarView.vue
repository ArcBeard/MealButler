<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, Plus, Clock, Flame, Sunrise, Sun, Sunset, Cookie, Loader2, Heart, RefreshCw, RotateCcw, CalendarDays, Calendar } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { mealTypeConfig } from '@/types/meals'
import type { MealType, Meal, DayPlan } from '@/types/meals'
import { useMealPlanStore } from '@/stores/mealPlan'
import { useFavoritesStore } from '@/stores/favorites'
import { usePreferencesStore } from '@/stores/preferences'
import { storeToRefs } from 'pinia'
import type { Component } from 'vue'
import AppWalkthrough from '@/components/walkthrough/AppWalkthrough.vue'

const router = useRouter()

const iconMap: Record<string, Component> = { Sunrise, Sun, Sunset, Cookie }

const mealPlanStore = useMealPlanStore()
const favoritesStore = useFavoritesStore()
const preferencesStore = usePreferencesStore()
const { isGenerating } = storeToRefs(mealPlanStore)

const today = new Date()
const weekOffset = ref(0)
const selectedDayIndex = ref(today.getDay() === 0 ? 6 : today.getDay() - 1)
const isLoading = ref(false)
const error = ref<string | null>(null)
const viewMode = ref<'daily' | 'weekly'>('daily')
const showResetDialog = ref(false)

const currentMonday = computed(() => {
  const d = new Date(today)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + weekOffset.value * 7
  d.setDate(diff)
  return d
})

const mondayISO = computed(() => {
  const d = currentMonday.value
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
})

const weekDays = computed(() => {
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(currentMonday.value)
    d.setDate(d.getDate() + i)
    days.push({
      date: d,
      dayAbbr: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
      dayLabel: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      isToday: d.toDateString() === today.toDateString(),
    })
  }
  return days
})

const weekLabel = computed(() => {
  const monDate = weekDays.value[0]?.date ?? new Date()
  const sunDate = weekDays.value[6]?.date ?? new Date()
  const monthStart = monDate.toLocaleDateString('en-US', { month: 'short' })
  const monthEnd = sunDate.toLocaleDateString('en-US', { month: 'short' })
  if (monthStart === monthEnd) {
    return `${monthStart} ${monDate.getDate()} – ${sunDate.getDate()}, ${monDate.getFullYear()}`
  }
  return `${monthStart} ${monDate.getDate()} – ${monthEnd} ${sunDate.getDate()}, ${sunDate.getFullYear()}`
})

const selectedDay = computed(() => weekDays.value[selectedDayIndex.value]!)

const selectedDayLabel = computed(() =>
  selectedDay.value!.date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }),
)

const weekPlan = ref<DayPlan[] | null>(null)

async function loadWeekPlan() {
  isLoading.value = true
  error.value = null
  const { status, plan } = await mealPlanStore.fetchWeekPlan(mondayISO.value)
  if (status === 'ready' && plan) {
    weekPlan.value = plan
  } else if (status === 'generating') {
    weekPlan.value = null
    const polled = await mealPlanStore.pollForPlan(mondayISO.value)
    weekPlan.value = polled
  } else {
    weekPlan.value = null
  }
  isLoading.value = false
}

async function regeneratePlan() {
  weekPlan.value = null
  mealPlanStore.clearCache()
  if (preferencesStore.preferences) {
    await preferencesStore.savePreferences(preferencesStore.preferences)
  }
  await loadWeekPlan()
}

function confirmResetMenu() {
  showResetDialog.value = false
  regeneratePlan()
}

watch(mondayISO, () => {
  weekPlan.value = null
  loadWeekPlan()
}, { immediate: true })

const dayPlan = computed(() => {
  if (!weekPlan.value) return null
  return weekPlan.value[selectedDayIndex.value] ?? null
})

const dayCalories = computed(() => {
  if (!dayPlan.value) return 0
  return Object.values(dayPlan.value.meals).reduce((sum, meal) => sum + (meal?.calories ?? 0), 0)
})

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

function prevWeek() { weekOffset.value-- }
function nextWeek() { weekOffset.value++ }
function goToToday() {
  weekOffset.value = 0
  selectedDayIndex.value = today.getDay() === 0 ? 6 : today.getDay() - 1
}

function navigateToRecipe(type: MealType, dayIndex?: number) {
  const idx = dayIndex ?? selectedDayIndex.value
  router.push(`/recipe/${mondayISO.value}/${idx}/${type}`)
}

function selectDayFromWeekly(dayIndex: number) {
  selectedDayIndex.value = dayIndex
  viewMode.value = 'daily'
}

function toggleFavorite(meal: Meal, event: Event) {
  event.stopPropagation()
  if (meal.recipe) {
    favoritesStore.toggleFavorite(meal.recipe)
  }
}

function handleRegenerate(event: Event) {
  event.stopPropagation()
  regeneratePlan()
}

const WALKTHROUGH_KEY = 'mealapp_show_walkthrough'
const showWalkthrough = ref(!!localStorage.getItem(WALKTHROUGH_KEY))

function dismissWalkthrough() {
  localStorage.removeItem(WALKTHROUGH_KEY)
  showWalkthrough.value = false
}

onMounted(() => {
  favoritesStore.fetchFavorites()
  if (!preferencesStore.preferences) {
    preferencesStore.fetchPreferences()
  }
})
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <AppWalkthrough v-if="showWalkthrough" @complete="dismissWalkthrough" />
    <!-- Week Navigator -->
    <div class="mb-4 flex items-center justify-between">
      <Button variant="ghost" size="icon" @click="prevWeek">
        <ChevronLeft class="h-5 w-5" />
      </Button>
      <div class="flex items-center gap-2">
        <button
          class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          @click="goToToday"
        >
          {{ weekLabel }}
        </button>
        <AlertDialog v-model:open="showResetDialog">
          <AlertDialogTrigger as-child>
            <Button
              v-if="weekPlan"
              variant="ghost"
              size="icon"
              class="h-8 w-8"
              title="Reset this week's menu"
            >
              <RotateCcw class="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset this week's menu?</AlertDialogTitle>
              <AlertDialogDescription>
                Jeeves will generate a completely new meal plan based on your current preferences.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction @click="confirmResetMenu">Reset Menu</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <Button variant="ghost" size="icon" @click="nextWeek">
        <ChevronRight class="h-5 w-5" />
      </Button>
    </div>

    <!-- View Mode Toggle -->
    <div v-if="weekPlan" class="mb-4 flex justify-center">
      <div class="inline-flex rounded-lg border border-border p-0.5">
        <Button
          :variant="viewMode === 'weekly' ? 'default' : 'ghost'"
          size="sm"
          class="gap-1.5 rounded-md"
          @click="viewMode = 'weekly'"
        >
          <CalendarDays class="h-4 w-4" />
          Weekly
        </Button>
        <Button
          :variant="viewMode === 'daily' ? 'default' : 'ghost'"
          size="sm"
          class="gap-1.5 rounded-md"
          @click="viewMode = 'daily'"
        >
          <Calendar class="h-4 w-4" />
          Daily
        </Button>
      </div>
    </div>

    <!-- Day Strip (daily view only) -->
    <div v-if="viewMode === 'daily'" class="mb-6 grid grid-cols-7 gap-1">
      <button
        v-for="(day, i) in weekDays"
        :key="day.dayNum"
        class="flex flex-col items-center gap-1 rounded-xl py-2 transition-colors"
        :class="[
          i === selectedDayIndex
            ? 'bg-primary text-primary-foreground'
            : day.isToday
              ? 'bg-secondary text-secondary-foreground'
              : 'hover:bg-accent',
        ]"
        @click="selectedDayIndex = i"
      >
        <span class="text-xs font-medium">{{ day.dayAbbr }}</span>
        <span class="text-lg font-bold leading-none">{{ day.dayNum }}</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading && !weekPlan" class="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <Loader2 class="h-8 w-8 animate-spin text-primary" />
      <p class="text-sm">Loading meal plan...</p>
    </div>

    <!-- Generating State -->
    <div v-else-if="isGenerating && !weekPlan" class="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <Loader2 class="h-8 w-8 animate-spin text-primary" />
      <p class="text-sm font-medium">Generating your meal plan...</p>
      <p class="text-xs">This usually takes about 30 seconds</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error && !weekPlan" class="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <p class="text-sm">Something went wrong loading your meal plan.</p>
      <Button variant="outline" size="sm" @click="loadWeekPlan">Try again</Button>
    </div>

    <!-- No Plan State -->
    <div v-else-if="!weekPlan" class="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <p class="text-sm">No meal plan for this week yet.</p>
      <p class="text-xs">Chat with Jeeves to generate one!</p>
    </div>

    <!-- Weekly View -->
    <template v-else-if="viewMode === 'weekly'">
      <div class="flex flex-col gap-5">
        <div v-for="(day, dayIdx) in weekDays" :key="dayIdx">
          <!-- Day Header -->
          <button
            class="mb-2 flex items-center gap-2 text-sm font-semibold transition-colors hover:text-primary"
            :class="day.isToday ? 'text-primary' : 'text-foreground'"
            @click="selectDayFromWeekly(dayIdx)"
          >
            {{ day.dayLabel }}
            <span v-if="day.isToday" class="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">Today</span>
          </button>

          <!-- Compact Meal Cards Row -->
          <div class="grid grid-cols-4 gap-2">
            <template v-for="type in mealTypes" :key="type">
              <button
                v-if="weekPlan?.[dayIdx]?.meals[type]"
                class="flex flex-col items-start gap-1 rounded-lg bg-card p-2 text-left transition-colors hover:bg-accent border border-border"
                @click="weekPlan![dayIdx]!.meals[type]!.recipe ? navigateToRecipe(type, dayIdx) : selectDayFromWeekly(dayIdx)"
              >
                <div class="flex w-full items-center gap-1">
                  <component :is="iconMap[mealTypeConfig[type].icon]" class="h-3 w-3 shrink-0 text-primary" />
                  <span class="text-lg leading-none">{{ weekPlan![dayIdx]!.meals[type]!.emoji }}</span>
                </div>
                <p class="w-full truncate text-xs font-medium">{{ weekPlan![dayIdx]!.meals[type]!.name }}</p>
                <span class="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Flame class="h-2.5 w-2.5" />
                  {{ weekPlan![dayIdx]!.meals[type]!.calories }} cal
                </span>
              </button>
              <div
                v-else
                class="flex items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 p-2 text-muted-foreground/40"
              >
                <Plus class="h-3 w-3" />
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- Daily View (existing) -->
    <template v-else>
      <!-- Selected Day Header -->
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">{{ selectedDayLabel }}</h2>
          <p v-if="dayCalories > 0" class="flex items-center gap-1 text-sm text-muted-foreground">
            <Flame class="h-3.5 w-3.5" />
            {{ dayCalories }} cal planned
          </p>
        </div>
        <Button
          v-if="weekOffset !== 0 || selectedDayIndex !== (today.getDay() === 0 ? 6 : today.getDay() - 1)"
          variant="outline"
          size="sm"
          @click="goToToday"
        >
          Today
        </Button>
      </div>

      <Separator class="mb-4" />

      <!-- Meal Sections -->
      <div class="flex flex-col gap-4">
        <div v-for="type in mealTypes" :key="type">
          <!-- Meal Type Header -->
          <div class="mb-2 flex items-center gap-2">
            <component :is="iconMap[mealTypeConfig[type].icon]" class="h-4 w-4 text-primary" />
            <span class="text-sm font-semibold">{{ mealTypeConfig[type].label }}</span>
            <span class="text-xs text-muted-foreground">{{ mealTypeConfig[type].time }}</span>
          </div>

          <!-- Filled Meal Card -->
          <div
            v-if="dayPlan?.meals[type]"
            class="relative h-40 overflow-hidden rounded-xl cursor-pointer select-none"
            @click="dayPlan.meals[type]!.recipe ? navigateToRecipe(type) : undefined"
          >
            <!-- Background: recipe image or emoji gradient -->
            <img
              v-if="dayPlan.meals[type]!.recipe?.imageUrl"
              :src="dayPlan.meals[type]!.recipe!.imageUrl"
              :alt="dayPlan.meals[type]!.name"
              class="absolute inset-0 h-full w-full object-cover"
            />
            <div
              v-else
              class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/30 via-primary/15 to-secondary/20"
            >
              <span class="text-6xl opacity-60">{{ dayPlan.meals[type]!.emoji }}</span>
            </div>

            <!-- Gradient overlay -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

            <!-- Action buttons — top right -->
            <div class="absolute right-2.5 top-2.5 flex gap-1.5">
              <!-- Favorite -->
              <button
                v-if="dayPlan.meals[type]!.recipe"
                class="flex items-center justify-center rounded-full bg-black/40 p-1.5 backdrop-blur-sm transition-transform active:scale-90"
                @click="toggleFavorite(dayPlan.meals[type]!, $event)"
              >
                <Heart
                  class="size-4"
                  :class="favoritesStore.isFavorite(dayPlan.meals[type]!.recipe!.spoonacularId)
                    ? 'fill-red-500 text-red-500'
                    : 'text-white'"
                />
              </button>
              <!-- Regenerate -->
              <button
                class="flex items-center justify-center rounded-full bg-black/40 p-1.5 backdrop-blur-sm transition-transform active:scale-90"
                @click="handleRegenerate($event)"
              >
                <RefreshCw
                  class="size-4 text-white"
                  :class="isGenerating ? 'animate-spin' : ''"
                />
              </button>
            </div>

            <!-- Emoji badge (when image is present) -->
            <div
              v-if="dayPlan.meals[type]!.recipe?.imageUrl"
              class="absolute left-2.5 top-2.5 text-xl leading-none"
            >
              {{ dayPlan.meals[type]!.emoji }}
            </div>

            <!-- Content — bottom -->
            <div class="absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
              <div class="min-w-0">
                <p class="truncate font-semibold text-white">{{ dayPlan.meals[type]!.name }}</p>
                <div class="mt-0.5 flex items-center gap-3 text-xs text-white/75">
                  <span class="flex items-center gap-1">
                    <Clock class="size-3" />
                    {{ dayPlan.meals[type]!.prepMinutes }} min
                  </span>
                  <span class="flex items-center gap-1">
                    <Flame class="size-3" />
                    {{ dayPlan.meals[type]!.calories }} cal
                  </span>
                </div>
              </div>
              <ChevronRight v-if="dayPlan.meals[type]!.recipe" class="size-4 shrink-0 text-white/60" />
            </div>
          </div>

          <!-- Empty Meal Slot -->
          <button
            v-else
            class="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 p-6 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <Plus class="h-4 w-4" />
            Add {{ mealTypeConfig[type].label.toLowerCase() }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
