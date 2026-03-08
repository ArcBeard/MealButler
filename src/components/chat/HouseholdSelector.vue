<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Minus, Plus } from 'lucide-vue-next'

const emit = defineEmits<{
  confirm: [value: string]
}>()

const adults = ref(1)
const kids = ref(0)

function formatHousehold(): string {
  const parts: string[] = []
  parts.push(adults.value === 1 ? '1 adult' : `${adults.value} adults`)
  if (kids.value > 0) {
    parts.push(kids.value === 1 ? '1 kid' : `${kids.value} kids`)
  }
  return parts.join(', ')
}

function handleConfirm() {
  emit('confirm', formatHousehold())
}
</script>

<template>
  <div class="ml-10 rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
    <!-- Adults counter -->
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium">Adults</span>
      <div class="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          class="size-8 rounded-full"
          :disabled="adults <= 1"
          @click="adults--"
        >
          <Minus class="size-4" />
        </Button>
        <span class="w-4 text-center text-sm font-semibold tabular-nums">{{ adults }}</span>
        <Button
          variant="outline"
          size="icon"
          class="size-8 rounded-full"
          :disabled="adults >= 10"
          @click="adults++"
        >
          <Plus class="size-4" />
        </Button>
      </div>
    </div>

    <!-- Kids counter -->
    <div class="mt-3 flex items-center justify-between">
      <span class="text-sm font-medium">Kids</span>
      <div class="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          class="size-8 rounded-full"
          :disabled="kids <= 0"
          @click="kids--"
        >
          <Minus class="size-4" />
        </Button>
        <span class="w-4 text-center text-sm font-semibold tabular-nums">{{ kids }}</span>
        <Button
          variant="outline"
          size="icon"
          class="size-8 rounded-full"
          :disabled="kids >= 10"
          @click="kids++"
        >
          <Plus class="size-4" />
        </Button>
      </div>
    </div>

    <!-- Confirm button -->
    <Button class="mt-4 w-full rounded-full" @click="handleConfirm">
      Confirm
    </Button>
  </div>
</template>
