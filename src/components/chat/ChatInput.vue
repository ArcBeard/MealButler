<script setup lang="ts">
import { ref } from 'vue'
import { SendHorizontal } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

defineProps<{
  disabled: boolean
}>()

const emit = defineEmits<{
  send: [message: string]
}>()

const inputText = ref('')

function handleSend() {
  const text = inputText.value.trim()
  if (!text) return
  emit('send', text)
  inputText.value = ''
}
</script>

<template>
  <div class="flex items-center gap-2 p-3">
    <input
      v-model="inputText"
      type="text"
      placeholder="Type a message..."
      class="flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring/50 placeholder:text-muted-foreground focus:ring-2 disabled:opacity-50"
      :disabled="disabled"
      @keydown.enter.prevent="handleSend"
    />
    <Button
      size="icon"
      class="shrink-0 rounded-full"
      :disabled="disabled || !inputText.trim()"
      @click="handleSend"
    >
      <SendHorizontal class="size-4" />
    </Button>
  </div>
</template>
