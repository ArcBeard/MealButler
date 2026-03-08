<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Calendar, ChefHat, List, MessageCircle, Users } from 'lucide-vue-next'
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
import type { Component } from 'vue'

const { navOpen } = storeToRefs(useNavigationStore())

const router = useRouter()

const iconMap: Record<string, Component> = {
  Calendar,
  ChefHat,
  List,
  MessageCircle,
  Users,
}

function navigateTo(path: string) {
  router.push(path)
  navOpen.value = false
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
          :class="$route.path === item.path && 'bg-secondary text-secondary-foreground font-semibold'"
          @click="navigateTo(item.path)"
        >
          <component :is="iconMap[item.icon]" class="h-5 w-5" />
          {{ item.label }}
        </Button>
      </nav>
    </SheetContent>
  </Sheet>
</template>
