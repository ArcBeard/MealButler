import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { ChatMessage, ConversationStep, MealPreferences } from '@/types/agent'
import { createAgentAdapter } from '@/services/agentAdapter'
import { STEP_ORDER, buildSummaryMessage } from '@/data/agentConversation'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'

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

  const showLoginPrompt = ref(false)

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
      await new Promise<void>((r) => setTimeout(r, 800))

      // Check for existing preferences — returning user flow
      const prefStore = usePreferencesStore()
      if (!prefStore.preferences) await prefStore.fetchPreferences()

      if (prefStore.preferences && prefStore.preferences.household) {
        // Pre-fill preferences from saved profile
        preferences.value = { ...prefStore.preferences }
        adapter = createAgentAdapter(preferences.value)
        currentStep.value = 'summary'

        const summaryLines = buildSummaryMessage(preferences.value)
        const msg = createMessage(
          'agent',
          `Welcome back! 🎩 I have your meal preferences on file.\n\n${summaryLines}`,
        )
        msg.quickReplies = [
          { label: 'Yes, generate a new plan', value: 'confirm' },
          { label: 'Update my preferences', value: 'start over' },
        ]
        messages.value.push(msg)
      } else {
        // New user — full onboarding
        messages.value.push(
          createMessage(
            'agent',
            "Good evening! I'm Jeeves, your personal meal planning butler. 🎩\n\nI shall be helping you plan a week of splendid dining.",
          ),
        )

        const response = await adapter.getGreeting()
        const msg = createMessage('agent', response.content)
        msg.quickReplies = response.quickReplies
        msg.widget = response.widget
        messages.value.push(msg)
        currentStep.value = response.nextStep
        isMultiSelect.value = response.multiSelect ?? false
      }
    } finally {
      isAgentTyping.value = false
    }
  }

  /** Stash preferences to localStorage before OAuth redirect */
  function stashPreferences() {
    localStorage.setItem('mealapp_stashed_preferences', JSON.stringify(preferences.value))
  }

  /** Restore stashed preferences after OAuth redirect and proceed */
  async function restoreStashedPreferences() {
    const stashed = localStorage.getItem('mealapp_stashed_preferences')
    if (!stashed) return
    localStorage.removeItem('mealapp_stashed_preferences')

    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    // Restore preferences and send confirmation to save with auth token
    preferences.value = JSON.parse(stashed)
    adapter = createAgentAdapter(preferences.value)
    await sendMessage('confirm')
  }

  /** Populate local preferences from user's answer at each step */
  function storePreference(step: ConversationStep, message: string) {
    switch (step) {
      case 'household':
        preferences.value.household = message
        break
      case 'dietary':
        preferences.value.dietary = message.split(', ')
        break
      case 'budget':
        preferences.value.budget = message
        break
      case 'skill':
        preferences.value.skill = message
        break
      case 'time':
        preferences.value.time = message
        break
      case 'cuisine':
        preferences.value.cuisine = message.split(', ')
        break
      case 'additional':
        preferences.value.notes = message
        break
    }
  }

  async function sendMessage(content: string) {
    if (isAgentTyping.value || isComplete.value) return

    // Capture user answer into preferences before forwarding to adapter
    storePreference(currentStep.value, content)

    clearLastQuickReplies()
    messages.value.push(createMessage('user', content))

    // Login-before-save: if confirming at summary and auth is configured but not logged in
    if (currentStep.value === 'summary' && !content.toLowerCase().includes('start over')) {
      const authStore = useAuthStore()
      if (authStore.isAuthConfigured && !authStore.isAuthenticated) {
        stashPreferences()
        showLoginPrompt.value = true
        // Remove the user message we just pushed — the flow continues after login
        messages.value.pop()
        return
      }
    }

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
    // Allow startConversation to re-run and check preferences again
  }

  return {
    messages,
    currentStep,
    preferences,
    isAgentTyping,
    isComplete,
    isMultiSelect,
    showLoginPrompt,
    progress,
    progressLabel,
    startConversation,
    sendMessage,
    resetConversation,
    restoreStashedPreferences,
  }
})
