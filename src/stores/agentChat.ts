import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { ChatMessage, ConversationStep, MealPreferences } from '@/types/agent'
import { createAgentAdapter } from '@/services/agentAdapter'
import { STEP_ORDER } from '@/data/agentConversation'

function emptyPreferences(): MealPreferences {
  return {
    household: '',
    dietary: [],
    budget: '',
    skill: '',
    time: '',
    cuisine: [],
    notes: '',
  }
}

export const useAgentChatStore = defineStore('agentChat', () => {
  const messages = ref<ChatMessage[]>([])
  const currentStep = ref<ConversationStep>('greeting')
  const isAgentTyping = ref(false)
  const isComplete = ref(false)
  const isMultiSelect = ref(false)
  const preferences = ref<MealPreferences>(emptyPreferences())

  let adapter = createAgentAdapter(preferences.value)
  let messageCounter = 0

  function createMessage(role: 'agent' | 'user', content: string): ChatMessage {
    return {
      id: `msg-${++messageCounter}`,
      role,
      content,
      timestamp: new Date(),
    }
  }

  function clearLastQuickReplies() {
    for (let i = messages.value.length - 1; i >= 0; i--) {
      if (messages.value[i]!.role === 'agent' && (messages.value[i]!.quickReplies || messages.value[i]!.widget)) {
        messages.value[i]!.quickReplies = undefined
        messages.value[i]!.widget = undefined
        break
      }
    }
  }

  const progress = computed(() => {
    const idx = STEP_ORDER.indexOf(currentStep.value)
    if (idx <= 0) return 0
    return Math.round((idx / (STEP_ORDER.length - 1)) * 100)
  })

  const progressLabel = computed(() => {
    const labels: Record<string, string> = {
      greeting: 'Getting started',
      household: 'Household size',
      dietary: 'Dietary needs',
      budget: 'Budget',
      skill: 'Skill level',
      time: 'Cooking time',
      cuisine: 'Cuisine preferences',
      additional: 'Additional notes',
      summary: 'Review',
      complete: 'Complete',
    }
    return labels[currentStep.value] ?? ''
  })

  async function startConversation() {
    if (messages.value.length > 0) return

    isAgentTyping.value = true
    try {
      // Butler introduction
      await new Promise<void>((r) => setTimeout(r, 800))
      messages.value.push(
        createMessage(
          'agent',
          "Good evening! I'm Jeeves, your personal meal planning butler. 🎩\n\nI shall be helping you plan a week of splendid dining.",
        ),
      )

      // Household question (adapter includes its own typing delay)
      const response = await adapter.getGreeting()
      const msg = createMessage('agent', response.content)
      msg.quickReplies = response.quickReplies
      msg.widget = response.widget
      messages.value.push(msg)
      currentStep.value = response.nextStep
      isMultiSelect.value = response.multiSelect ?? false
    } finally {
      isAgentTyping.value = false
    }
  }

  async function sendMessage(content: string) {
    if (isAgentTyping.value || isComplete.value) return

    clearLastQuickReplies()
    messages.value.push(createMessage('user', content))

    isAgentTyping.value = true
    try {
      const response = await adapter.sendMessage(content, currentStep.value)
      const msg = createMessage('agent', response.content)
      msg.quickReplies = response.quickReplies
      msg.widget = response.widget
      messages.value.push(msg)
      currentStep.value = response.nextStep
      isMultiSelect.value = response.multiSelect ?? false

      if (response.nextStep === 'complete') {
        isComplete.value = true
      }

      // Reset on "start over"
      if (response.nextStep === 'household' && messages.value.length > 2) {
        preferences.value = emptyPreferences()
        adapter = createAgentAdapter(preferences.value)
      }
    } finally {
      isAgentTyping.value = false
    }
  }

  function resetConversation() {
    messages.value = []
    currentStep.value = 'greeting'
    isAgentTyping.value = false
    isComplete.value = false
    isMultiSelect.value = false
    messageCounter = 0
    preferences.value = emptyPreferences()
    adapter = createAgentAdapter(preferences.value)
  }

  return {
    messages,
    currentStep,
    preferences,
    isAgentTyping,
    isComplete,
    isMultiSelect,
    progress,
    progressLabel,
    startConversation,
    sendMessage,
    resetConversation,
  }
})
