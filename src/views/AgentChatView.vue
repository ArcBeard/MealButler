<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAgentChatStore } from '@/stores/agentChat'
import ChatProgressBar from '@/components/chat/ChatProgressBar.vue'
import ChatMessageList from '@/components/chat/ChatMessageList.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import LoginPromptDialog from '@/components/LoginPromptDialog.vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const store = useAgentChatStore()
const authStore = useAuthStore()
const {
  messages,
  isAgentTyping,
  isComplete,
  isMultiSelect,
  showLoginPrompt,
  progress,
  progressLabel,
} = storeToRefs(store)
const { startConversation, sendMessage } = store

onMounted(() => {
  startConversation()
  // After OAuth redirect: restore stashed preferences and confirm
  if (authStore.isAuthenticated) {
    store.restoreStashedPreferences()
  }
})

// Navigate to calendar after completion when authenticated
watch(isComplete, (complete) => {
  if (complete && authStore.isAuthenticated) {
    setTimeout(() => router.push('/calendar'), 2000)
  }
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

    <LoginPromptDialog
      :open="showLoginPrompt"
      @update:open="showLoginPrompt = $event"
      @skip="sendMessage('confirm')"
    />
  </div>
</template>
