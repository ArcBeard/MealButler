<script setup lang="ts">
import { ref, watch, nextTick, type DeepReadonly } from 'vue'
import type { ChatMessage, QuickReply } from '@/types/agent'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import ButlerIcon from '@/components/icons/ButlerIcon.vue'
import ChatBubble from './ChatBubble.vue'
import HouseholdSelector from './HouseholdSelector.vue'

const props = defineProps<{
  messages: DeepReadonly<ChatMessage[]>
  isTyping: boolean
  isMultiSelect: boolean
}>()

const emit = defineEmits<{
  quickReply: [value: string]
}>()

const scrollContainer = ref<HTMLElement | null>(null)
const selectedMulti = ref<Set<string>>(new Set())
const otherText = ref('')
const showOtherInput = ref(false)

function scrollToBottom() {
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
    }
  })
}

watch(
  () => props.messages.length,
  () => scrollToBottom(),
)

watch(
  () => props.isTyping,
  () => scrollToBottom(),
)

function getLastAgentMessage(): DeepReadonly<ChatMessage> | undefined {
  for (let i = props.messages.length - 1; i >= 0; i--) {
    if (props.messages[i]!.role === 'agent') {
      return props.messages[i]
    }
  }
  return undefined
}

function getLastAgentQuickReplies(): readonly QuickReply[] | undefined {
  const msg = getLastAgentMessage()
  if (msg?.quickReplies?.length) {
    return msg.quickReplies as readonly QuickReply[]
  }
  return undefined
}

function handleQuickReply(reply: QuickReply) {
  if (props.isMultiSelect) {
    if (selectedMulti.value.has(reply.value)) {
      selectedMulti.value.delete(reply.value)
    } else {
      selectedMulti.value.add(reply.value)
    }
    // Force reactivity
    selectedMulti.value = new Set(selectedMulti.value)
  } else {
    emit('quickReply', reply.label)
  }
}

function handleMultiSelectDone() {
  const trimmedOther = otherText.value.trim()
  if (selectedMulti.value.size === 0 && !trimmedOther) return

  const labels: string[] = []
  const replies = getLastAgentQuickReplies()
  if (replies) {
    for (const r of replies) {
      if (selectedMulti.value.has(r.value)) {
        labels.push(r.label)
      }
    }
  }
  if (trimmedOther) {
    labels.push(trimmedOther)
  }

  emit('quickReply', labels.join(', '))
  selectedMulti.value = new Set()
  otherText.value = ''
}

// Reset multi-select state when messages change (agent responded)
watch(
  () => props.messages.length,
  () => {
    selectedMulti.value = new Set()
    otherText.value = ''
    showOtherInput.value = false
  },
)
</script>

<template>
  <div ref="scrollContainer" class="flex-1 overflow-y-auto px-4 py-4">
    <div class="flex flex-col gap-4">
      <ChatBubble v-for="msg in messages" :key="msg.id" :message="msg" />

      <!-- Typing indicator -->
      <div v-if="isTyping" class="flex items-center gap-2">
        <Avatar class="size-8 shrink-0">
          <AvatarFallback class="bg-primary text-primary-foreground">
            <ButlerIcon :size="16" />
          </AvatarFallback>
        </Avatar>
        <div class="flex gap-1 rounded-2xl rounded-tl-sm bg-secondary px-4 py-3">
          <span class="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
          <span class="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
          <span class="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
        </div>
      </div>

      <!-- Household widget -->
      <HouseholdSelector
        v-if="!isTyping && getLastAgentMessage()?.widget === 'household'"
        @confirm="$emit('quickReply', $event)"
      />

      <!-- Quick replies -->
      <div
        v-if="!isTyping && !getLastAgentMessage()?.widget && getLastAgentQuickReplies()"
        class="ml-10 flex flex-col gap-2"
      >
        <!-- Pill buttons -->
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="reply in getLastAgentQuickReplies()"
            :key="reply.value"
            :variant="isMultiSelect && selectedMulti.has(reply.value) ? 'default' : 'outline'"
            size="sm"
            class="rounded-full"
            @click="handleQuickReply(reply)"
          >
            {{ reply.label }}
          </Button>
          <!-- "Other" toggle button (multi-select only) -->
          <Button
            v-if="isMultiSelect"
            :variant="showOtherInput ? 'default' : 'outline'"
            size="sm"
            class="rounded-full"
            @click="showOtherInput = !showOtherInput"
          >
            Other
          </Button>
        </div>

        <!-- "Other" text input (revealed on click) -->
        <div v-if="isMultiSelect && showOtherInput" class="flex gap-2">
          <input
            v-model="otherText"
            type="text"
            placeholder="Type your own..."
            class="h-9 flex-1 rounded-full border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
            @keyup.enter="handleMultiSelectDone"
          />
        </div>

        <!-- Done button (multi-select only, below everything) -->
        <Button
          v-if="isMultiSelect"
          size="sm"
          class="w-fit rounded-full"
          :disabled="selectedMulti.size === 0 && !otherText.trim()"
          @click="handleMultiSelectDone"
        >
          Done
        </Button>
      </div>
    </div>
  </div>
</template>
