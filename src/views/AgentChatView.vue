<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAgentChatStore } from '@/stores/agentChat'
import ChatProgressBar from '@/components/chat/ChatProgressBar.vue'
import ChatMessageList from '@/components/chat/ChatMessageList.vue'
import ChatInput from '@/components/chat/ChatInput.vue'

const store = useAgentChatStore()
const {
  messages,
  isAgentTyping,
  isComplete,
  isMultiSelect,
  progress,
  progressLabel,
} = storeToRefs(store)
const { startConversation, sendMessage } = store

onMounted(() => {
  startConversation()
})
</script>

<template>
  <div class="mx-auto flex h-[calc(100vh-3.5rem)] max-w-2xl flex-col">
    <div class="border-b px-4 py-3">
      <ChatProgressBar :progress="progress" :label="progressLabel" />
    </div>

    <ChatMessageList
      :messages="messages"
      :is-typing="isAgentTyping"
      :is-multi-select="isMultiSelect"
      @quick-reply="sendMessage"
    />

    <div class="border-t">
      <ChatInput
        :disabled="isAgentTyping || isComplete"
        @send="sendMessage"
      />
    </div>
  </div>
</template>
