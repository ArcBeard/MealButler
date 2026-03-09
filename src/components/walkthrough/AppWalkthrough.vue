<script setup lang="ts">
import { ref } from 'vue'
import { CalendarDays, Heart, Settings, ChefHat } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import type { Component } from 'vue'

const emit = defineEmits<{
  complete: []
}>()

interface WalkthroughCard {
  icon: Component
  title: string
  description: string
}

const cards: WalkthroughCard[] = [
  {
    icon: ChefHat,
    title: 'Your Menu is Cooking',
    description: 'Jeeves is generating your personalized meal plan. This takes about 30 seconds.',
  },
  {
    icon: CalendarDays,
    title: 'Weekly Calendar',
    description: 'Your meals are organized by day. Tap any meal to see the full recipe.',
  },
  {
    icon: Heart,
    title: 'Favorites',
    description: 'Love a recipe? Tap the heart to save it. Jeeves will include your favorites in future plans.',
  },
  {
    icon: Settings,
    title: 'Family Settings',
    description: 'Update your preferences anytime from the settings page.',
  },
]

const currentIndex = ref(0)
const isLastCard = ref(false)

function next() {
  if (currentIndex.value < cards.length - 1) {
    currentIndex.value++
    isLastCard.value = currentIndex.value === cards.length - 1
  } else {
    dismiss()
  }
}

function dismiss() {
  emit('complete')
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div class="flex w-full max-w-sm flex-col items-center px-6 text-center">
        <!-- Icon -->
        <div class="mb-6 flex size-20 items-center justify-center rounded-full bg-primary/10">
          <component :is="cards[currentIndex]!.icon" class="size-10 text-primary" />
        </div>

        <!-- Title -->
        <h2 class="mb-2 text-xl font-bold">{{ cards[currentIndex]!.title }}</h2>

        <!-- Description -->
        <p class="mb-8 text-sm text-muted-foreground">{{ cards[currentIndex]!.description }}</p>

        <!-- Dot indicators -->
        <div class="mb-6 flex gap-2">
          <span
            v-for="(_, i) in cards"
            :key="i"
            class="size-2 rounded-full transition-colors"
            :class="i === currentIndex ? 'bg-primary' : 'bg-muted-foreground/30'"
          />
        </div>

        <!-- Actions -->
        <Button class="w-full" @click="next">
          {{ isLastCard ? 'Get Started' : 'Next' }}
        </Button>
        <button
          v-if="!isLastCard"
          class="mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          @click="dismiss"
        >
          Skip
        </button>
      </div>
    </div>
  </Teleport>
</template>
