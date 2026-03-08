<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronLeft, ChevronRight, Plus, Clock, Flame, Sunrise, Sun, Sunset, Cookie } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { mealTypeConfig } from '@/types/meals'
import type { MealType } from '@/types/meals'
import { generateMockWeek } from '@/data/mockMeals'
import type { Component } from 'vue'

const iconMap: Record<string, Component> = { Sunrise, Sun, Sunset, Cookie }

const today = new Date()
const weekOffset = ref(0)
const selectedDayIndex = ref(today.getDay() === 0 ? 6 : today.getDay() - 1)

const currentMonday = computed(() => {
  const d = new Date(today)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + weekOffset.value * 7
  d.setDate(diff)
  return d
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

const weekPlan = computed(() => generateMockWeek(currentMonday.value))

const dayPlan = computed(() => weekPlan.value[selectedDayIndex.value])

const dayCalories = computed(() => {
  if (!dayPlan.value) return 0
  return Object.values(dayPlan.value.meals).reduce((sum, meal) => sum + (meal?.calories ?? 0), 0)
})

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

function prevWeek() {
  weekOffset.value--
}

function nextWeek() {
  weekOffset.value++
}

function goToToday() {
  weekOffset.value = 0
  selectedDayIndex.value = today.getDay() === 0 ? 6 : today.getDay() - 1
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <!-- Week Navigator -->
    <div class="mb-4 flex items-center justify-between">
      <Button variant="ghost" size="icon" @click="prevWeek">
        <ChevronLeft class="h-5 w-5" />
      </Button>
      <button
        class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        @click="goToToday"
      >
        {{ weekLabel }}
      </button>
      <Button variant="ghost" size="icon" @click="nextWeek">
        <ChevronRight class="h-5 w-5" />
      </Button>
    </div>

    <!-- Day Strip -->
    <div class="mb-6 grid grid-cols-7 gap-1">
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

    <!-- Selected Day Header -->
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold">{{ selectedDayLabel }}</h2>
        <p v-if="dayCalories > 0" class="flex items-center gap-1 text-sm text-muted-foreground">
          <Flame class="h-3.5 w-3.5" />
          {{ dayCalories }} cal planned
        </p>
      </div>
      <Button v-if="weekOffset !== 0 || selectedDayIndex !== (today.getDay() === 0 ? 6 : today.getDay() - 1)" variant="outline" size="sm" @click="goToToday">
        Today
      </Button>
    </div>

    <Separator class="mb-4" />

    <!-- Meal Sections -->
    <div class="flex flex-col gap-3">
      <div v-for="type in mealTypes" :key="type">
        <!-- Meal Type Header -->
        <div class="mb-2 flex items-center gap-2">
          <component :is="iconMap[mealTypeConfig[type].icon]" class="h-4 w-4 text-primary" />
          <span class="text-sm font-semibold">{{ mealTypeConfig[type].label }}</span>
          <span class="text-xs text-muted-foreground">{{ mealTypeConfig[type].time }}</span>
        </div>

        <!-- Filled Meal Card -->
        <Card v-if="dayPlan?.meals[type]" class="transition-shadow hover:shadow-md">
          <CardContent class="flex items-center gap-3 p-3">
            <span class="text-2xl">{{ dayPlan.meals[type]!.emoji }}</span>
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate">{{ dayPlan.meals[type]!.name }}</p>
              <div class="flex items-center gap-3 text-xs text-muted-foreground">
                <span class="flex items-center gap-1">
                  <Clock class="h-3 w-3" />
                  {{ dayPlan.meals[type]!.prepMinutes }} min
                </span>
                <span class="flex items-center gap-1">
                  <Flame class="h-3 w-3" />
                  {{ dayPlan.meals[type]!.calories }} cal
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Empty Meal Slot -->
        <button
          v-else
          class="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <Plus class="h-4 w-4" />
          Add {{ mealTypeConfig[type].label.toLowerCase() }}
        </button>
      </div>
    </div>
  </div>
</template>
