<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Calendar, List, MessageCircle, Users } from 'lucide-vue-next'
import { navigationItems } from '@/types/navigation'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { storeToRefs } from 'pinia'
import { useNavigationStore } from '@/stores/navigation'
import { useMealPlanStore } from '@/stores/mealPlan'
import { usePreferencesStore } from '@/stores/preferences'
import { computed } from 'vue'
import type { Component } from 'vue'

const { navOpen } = storeToRefs(useNavigationStore())
const mealPlanStore = useMealPlanStore()
const prefStore = usePreferencesStore()
const isUnlocked = computed(() => mealPlanStore.hasCurrentWeekPlan || !!prefStore.preferences)

const router = useRouter()

const iconMap: Record<string, Component> = {
  Calendar,
  List,
  MessageCircle,
  Users,
}

function navigateTo(path: string) {
  router.push(path)
  navOpen.value = false
}

function isItemDisabled(path: string) {
  return path !== '/' && !isUnlocked.value
}
</script>

<template>
  <Sheet v-model:open="navOpen">
    <SheetContent side="left" class="w-64">
      <SheetHeader>
        <SheetTitle class="text-primary">Navigation</SheetTitle>
        <SheetDescription class="sr-only">Main navigation menu</SheetDescription>
      </SheetHeader>
      <nav class="mt-4 flex flex-col gap-1">
        <Button
          v-for="item in navigationItems"
          :key="item.path"
          variant="ghost"
          class="justify-start gap-3 text-foreground hover:bg-secondary hover:text-secondary-foreground"
          :class="[
            $route.path === item.path && 'bg-secondary text-secondary-foreground font-semibold',
            isItemDisabled(item.path) && 'opacity-40 cursor-not-allowed pointer-events-none',
          ]"
          :disabled="isItemDisabled(item.path)"
          :title="isItemDisabled(item.path) ? 'Complete the meal planning chat to unlock' : undefined"
          @click="navigateTo(item.path)"
        >
          <component :is="iconMap[item.icon]" class="h-5 w-5" />
          {{ item.label }}
        </Button>
      </nav>
      <p v-if="!isUnlocked" class="mt-4 px-2 text-xs text-muted-foreground">
        Complete the meal planning chat to unlock all pages.
      </p>
    </SheetContent>
  </Sheet>
</template>
