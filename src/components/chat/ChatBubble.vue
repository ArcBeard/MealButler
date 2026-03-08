<script setup lang="ts">
import type { DeepReadonly } from 'vue'
import type { ChatMessage } from '@/types/agent'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import ButlerIcon from '@/components/icons/ButlerIcon.vue'

defineProps<{
  message: DeepReadonly<ChatMessage>
}>()
</script>

<template>
  <div
    class="flex gap-2"
    :class="message.role === 'user' ? 'flex-row-reverse' : 'flex-row'"
  >
    <Avatar v-if="message.role === 'agent'" class="mt-1 size-8 shrink-0">
      <AvatarFallback class="bg-primary text-primary-foreground">
        <ButlerIcon :size="16" />
      </AvatarFallback>
    </Avatar>

    <div
      class="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
      :class="
        message.role === 'agent'
          ? 'bg-secondary text-secondary-foreground rounded-tl-sm'
          : 'bg-primary text-primary-foreground rounded-tr-sm'
      "
    >
      <p class="whitespace-pre-line">{{ message.content }}</p>
    </div>
  </div>
</template>
