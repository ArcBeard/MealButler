<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Calendar, ChefHat, List, Users } from 'lucide-vue-next'
import { navigationItems } from '@/types/navigation'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { Component } from 'vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const router = useRouter()

const iconMap: Record<string, Component> = {
  Calendar,
  ChefHat,
  List,
  Users,
}

function navigateTo(path: string) {
  router.push(path)
  emit('update:open', false)
}
</script>

<template>
  <Sheet :open="props.open" @update:open="emit('update:open', $event)">
    <SheetContent side="left" class="w-64">
      <SheetHeader>
        <SheetTitle>Navigation</SheetTitle>
      </SheetHeader>
      <nav class="mt-4 flex flex-col gap-1">
        <Button
          v-for="item in navigationItems"
          :key="item.path"
          variant="ghost"
          class="justify-start gap-3"
          @click="navigateTo(item.path)"
        >
          <component :is="iconMap[item.icon]" class="h-5 w-5" />
          {{ item.label }}
        </Button>
      </nav>
    </SheetContent>
  </Sheet>
</template>
