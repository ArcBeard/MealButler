import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getConfig } from '@/services/config'
import { useAuthStore } from '@/stores/auth'
import { generateMockWeek } from '@/data/mockMeals'
import type { DayPlan } from '@/types/meals'

export const useMealPlanStore = defineStore('mealPlan', () => {
  const weekPlans = ref<Record<string, DayPlan[]>>({})
  const isLoading = ref(false)
  const isGenerating = ref(false)
  const error = ref<string | null>(null)

  async function fetchWeekPlan(weekStart: string): Promise<DayPlan[] | null> {
    // Return cached data if available
    if (weekPlans.value[weekStart]) return weekPlans.value[weekStart]!

    const config = await getConfig()
    if (!config.apiUrl) {
      // Local dev: use mock data
      const monday = new Date(weekStart + 'T00:00:00')
      const mockPlan = generateMockWeek(monday)
      weekPlans.value[weekStart] = mockPlan
      return mockPlan
    }

    isLoading.value = true
    error.value = null

    try {
      const authStore = useAuthStore()
      const token = await authStore.getToken()
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = token

      const params = new URLSearchParams({ week: weekStart })
      const response = await fetch(`${config.apiUrl}/api/meal-plan?${params}`, { headers })

      if (response.status === 404) {
        return null // Plan doesn't exist yet
      }

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const data = await response.json()
      weekPlans.value[weekStart] = data.mealPlan
      return data.mealPlan
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch meal plan'
      console.error('Failed to fetch meal plan:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /** Poll for a meal plan that's being generated */
  async function pollForPlan(
    weekStart: string,
    intervalMs = 5000,
    timeoutMs = 120000,
  ): Promise<DayPlan[] | null> {
    isGenerating.value = true
    const startTime = Date.now()

    try {
      while (Date.now() - startTime < timeoutMs) {
        // Clear cache to get a fresh fetch
        delete weekPlans.value[weekStart]
        const plan = await fetchWeekPlan(weekStart)
        if (plan) {
          isGenerating.value = false
          return plan
        }
        await new Promise((r) => setTimeout(r, intervalMs))
      }
      isGenerating.value = false
      return null
    } catch {
      isGenerating.value = false
      return null
    }
  }

  function clearCache() {
    weekPlans.value = {}
  }

  return {
    weekPlans,
    isLoading,
    isGenerating,
    error,
    fetchWeekPlan,
    pollForPlan,
    clearCache,
  }
})
