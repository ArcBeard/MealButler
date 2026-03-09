import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getConfig } from '@/services/config'
import { useAuthStore } from '@/stores/auth'
import { generateMockWeek } from '@/data/mockMeals'
import type { DayPlan } from '@/types/meals'

type PlanStatus = 'ready' | 'generating' | 'not_found'

function getCurrentWeekMonday(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const d = new Date(now)
  d.setDate(diff)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** DJB2 hash of a string, returned as base-36 */
function hashString(str: string): string {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) & 0xffffffff
  }
  return (h >>> 0).toString(36)
}

export const useMealPlanStore = defineStore('mealPlan', () => {
  const weekPlans = ref<Record<string, DayPlan[]>>({})
  const planHashes = ref<Record<string, string>>({})
  const isLoading = ref(false)
  const isGenerating = ref(false)
  const dayRegenerating = ref<string | null>(null)
  const error = ref<string | null>(null)
  const hasCurrentWeekPlan = ref(false)

  /** Fetch a week's meal plan. Always validates cache against the server. */
  async function fetchWeekPlan(weekStart: string): Promise<{ status: PlanStatus; plan: DayPlan[] | null }> {
    console.debug('[MealPlan] fetchWeekPlan called for week:', weekStart)
    const config = await getConfig()
    if (!config.apiUrl) {
      console.debug('[MealPlan] No apiUrl, using mock data')
      // Local dev: use mock data (no server to validate against)
      if (!weekPlans.value[weekStart]) {
        const monday = new Date(weekStart + 'T00:00:00')
        const mockPlan = generateMockWeek(monday)
        weekPlans.value[weekStart] = mockPlan
        planHashes.value[weekStart] = hashString(JSON.stringify(mockPlan))
      }
      return { status: 'ready', plan: weekPlans.value[weekStart]! }
    }

    const cached = weekPlans.value[weekStart]
    console.debug('[MealPlan] Cache status:', {
      hasCached: !!cached,
      cachedHash: planHashes.value[weekStart],
      cachedDates: cached?.map(d => d.date),
    })
    // Only show loading spinner when we have nothing cached
    if (!cached) isLoading.value = true
    error.value = null

    try {
      const authStore = useAuthStore()
      const token = await authStore.getToken()
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = token

      const params = new URLSearchParams({ week: weekStart })
      const url = `${config.apiUrl}/api/meal-plan?${params}`
      console.debug('[MealPlan] Fetching:', url)
      const response = await fetch(url, { headers })

      if (response.status === 404) {
        console.debug('[MealPlan] 404 — plan not found')
        // Plan was deleted or never existed — clear stale cache
        delete weekPlans.value[weekStart]
        delete planHashes.value[weekStart]
        return { status: 'not_found', plan: null }
      }

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const data = await response.json()
      console.debug('[MealPlan] API response:', {
        status: data.status,
        week: data.week,
        createdAt: data.createdAt,
        mealPlanDates: data.mealPlan?.map((d: DayPlan) => d.date),
        requestedWeek: weekStart,
        weekMismatch: data.week !== weekStart,
      })

      // Track per-day regeneration state
      dayRegenerating.value = data.dayRegenerating ?? null

      if (data.status === 'generating') {
        return { status: 'generating', plan: null }
      }

      // Compare hash to detect changes
      const newHash = hashString(JSON.stringify(data.mealPlan))
      if (cached && planHashes.value[weekStart] === newHash) {
        console.debug('[MealPlan] Hash match — serving cached data')
        return { status: 'ready', plan: cached }
      }

      console.debug('[MealPlan] Updating cache, hash:', { old: planHashes.value[weekStart], new: newHash })
      // Plan is new or changed — update cache
      weekPlans.value[weekStart] = data.mealPlan
      planHashes.value[weekStart] = newHash
      return { status: 'ready', plan: data.mealPlan }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch meal plan'
      console.error('[MealPlan] Fetch failed:', err)
      // Return stale cache if available, otherwise not_found
      if (cached) {
        console.debug('[MealPlan] Returning stale cache on error')
        return { status: 'ready', plan: cached }
      }
      return { status: 'not_found', plan: null }
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
        const { status, plan } = await fetchWeekPlan(weekStart)
        if (status === 'ready' && plan) {
          isGenerating.value = false
          return plan
        }
        if (status === 'not_found') {
          isGenerating.value = false
          return null
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

  /** Regenerate a single day's meals */
  async function regenerateDay(weekStart: string, date: string): Promise<DayPlan[] | null> {
    const config = await getConfig()
    if (!config.apiUrl) return null

    dayRegenerating.value = date
    error.value = null

    try {
      const authStore = useAuthStore()
      const token = await authStore.getToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = token

      const response = await fetch(`${config.apiUrl}/api/meal-plan/regenerate-day`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ weekStart, date }),
      })

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      // Invalidate cache so polling fetches fresh data
      delete planHashes.value[weekStart]

      // Poll until the day is regenerated (dayRegenerating clears when done)
      const plan = await pollForDayRegeneration(weekStart)
      return plan
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to regenerate day'
      console.error('[MealPlan] regenerateDay failed:', err)
      dayRegenerating.value = null
      return null
    }
  }

  /** Poll until dayRegenerating is cleared (single-day regeneration complete) */
  async function pollForDayRegeneration(
    weekStart: string,
    intervalMs = 3000,
    timeoutMs = 90000,
  ): Promise<DayPlan[] | null> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      const { status, plan } = await fetchWeekPlan(weekStart)
      if (status === 'ready' && plan && !dayRegenerating.value) {
        return plan
      }
      await new Promise((r) => setTimeout(r, intervalMs))
    }

    dayRegenerating.value = null
    return null
  }

  /** Check if the current week has a ready meal plan. Called on app startup. */
  async function initialize() {
    const monday = getCurrentWeekMonday()
    console.debug('[MealPlan] initialize() — currentWeekMonday:', monday, 'today:', new Date().toISOString())
    const { status } = await fetchWeekPlan(monday)
    hasCurrentWeekPlan.value = status === 'ready'
    console.debug('[MealPlan] initialize() done — hasCurrentWeekPlan:', hasCurrentWeekPlan.value)
  }

  function clearCache() {
    console.debug('[MealPlan] clearCache() — clearing all cached weeks:', Object.keys(weekPlans.value))
    weekPlans.value = {}
    planHashes.value = {}
  }

  return {
    weekPlans,
    isLoading,
    isGenerating,
    dayRegenerating,
    error,
    hasCurrentWeekPlan,
    initialize,
    fetchWeekPlan,
    pollForPlan,
    regenerateDay,
    clearCache,
  }
})
