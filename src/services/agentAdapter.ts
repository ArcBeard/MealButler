import type { AgentAdapter, AgentResponse, ConversationStep, MealPreferences } from '@/types/agent'
import { conversationSteps, buildSummaryMessage } from '@/data/agentConversation'
import { getConfig } from '@/services/config'
import { useAuthStore } from '@/stores/auth'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomDelay(): number {
  return 800 + Math.random() * 700
}

function createMockAgent(preferences: MealPreferences): AgentAdapter {
  function storePreference(step: ConversationStep, message: string) {
    switch (step) {
      case 'household':
        preferences.household = message
        break
      case 'dietary':
        preferences.dietary = message.split(', ')
        break
      case 'budget':
        preferences.budget = message
        break
      case 'skill':
        preferences.skill = message
        break
      case 'time':
        preferences.time = message
        break
      case 'cuisine':
        preferences.cuisine = message.split(', ')
        break
      case 'additional':
        preferences.notes = message
        break
    }
  }

  return {
    async getGreeting(): Promise<AgentResponse> {
      await delay(randomDelay())
      const step = conversationSteps.household!
      return {
        content: step.question,
        quickReplies: step.quickReplies,
        nextStep: 'household',
        multiSelect: step.multiSelect,
        widget: step.widget as AgentResponse['widget'],
      }
    },

    async sendMessage(message: string, step: ConversationStep): Promise<AgentResponse> {
      await delay(randomDelay())

      if (step === 'summary') {
        if (message.toLowerCase().includes('start over')) {
          // Reset preferences
          Object.assign(preferences, {
            household: '',
            dietary: [],
            budget: '',
            skill: '',
            time: '',
            cuisine: [],
            notes: '',
          })
          const firstStep = conversationSteps.household!
          return {
            content: "No problem! Let's start fresh.\n\n" + firstStep.question,
            quickReplies: firstStep.quickReplies,
            nextStep: 'household',
            multiSelect: firstStep.multiSelect,
            widget: firstStep.widget as AgentResponse['widget'],
          }
        }
        return {
          content:
            "Great! I'll use these preferences to generate your weekly meal plan. Stay tuned! 🎉\n\nThese preferences have been saved to your profile. You can adjust them anytime by chatting with me again or visiting the Family Settings page.",
          nextStep: 'complete',
        }
      }

      storePreference(step, message)

      const stepConfig = conversationSteps[step]
      if (!stepConfig) {
        return { content: 'Something went wrong.', nextStep: 'complete' }
      }

      const nextStepKey = stepConfig.nextStep

      if (nextStepKey === 'summary') {
        const summary = buildSummaryMessage(preferences)
        return {
          content: summary,
          quickReplies: [
            { label: 'Looks great!', value: 'confirm' },
            { label: 'Start over', value: 'restart' },
          ],
          nextStep: 'summary',
        }
      }

      const nextConfig = conversationSteps[nextStepKey]
      if (!nextConfig) {
        return { content: 'Something went wrong.', nextStep: 'complete' }
      }

      return {
        content: nextConfig.question,
        quickReplies: nextConfig.quickReplies,
        nextStep: nextStepKey,
        multiSelect: nextConfig.multiSelect,
        widget: nextConfig.widget as AgentResponse['widget'],
      }
    },
  }
}

function createBedrockAgent(preferences: MealPreferences): AgentAdapter {
  const sessionId = crypto.randomUUID()

  return {
    async getGreeting(): Promise<AgentResponse> {
      const config = await getConfig()
      if (!config.apiUrl) {
        return createMockAgent(preferences).getGreeting()
      }
      return this.sendMessage('hello', 'greeting')
    },

    async sendMessage(message: string, step: ConversationStep): Promise<AgentResponse> {
      const config = await getConfig()
      if (!config.apiUrl) {
        // Fallback to mock when no backend configured
        return createMockAgent(preferences).sendMessage(message, step)
      }

      try {
        const authStore = useAuthStore()
        const token = await authStore.getToken()
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) {
          headers['Authorization'] = token
        }

        const response = await fetch(`${config.apiUrl}/api/agent`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sessionId,
            inputText: message,
            step,
            preferences: step === 'summary' ? preferences : undefined,
          }),
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const data = await response.json()
        return {
          content: data.content,
          quickReplies: data.quickReplies,
          nextStep: data.nextStep ?? step,
          multiSelect: data.multiSelect,
          widget: data.widget,
        }
      } catch (error) {
        console.error('Bedrock agent error:', error)
        // Graceful fallback: stay on current step with error message
        return {
          content: "I'm having trouble connecting right now. Please try again.",
          nextStep: step,
        }
      }
    },
  }
}

// Uses Bedrock agent when config.json provides an apiUrl, falls back to mock
export function createAgentAdapter(preferences: MealPreferences): AgentAdapter {
  return createBedrockAgent(preferences)
}
