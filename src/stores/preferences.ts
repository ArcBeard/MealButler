import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getConfig } from '@/services/config'
import { useAuthStore } from '@/stores/auth'
import { useMealPlanStore } from '@/stores/mealPlan'
import type { MealPreferences } from '@/types/agent'

const STORAGE_KEY = 'mealapp-preferences'

export const usePreferencesStore = defineStore('preferences', () => {
  const preferences = ref<MealPreferences | null>(null)
  const savedSnapshot = ref<string | null>(null)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref<string | null>(null)

  async function fetchPreferences() {
    console.debug('[prefs] fetchPreferences() called')
    const config = await getConfig()
    console.debug('[prefs] config:', { apiUrl: config.apiUrl })

    if (!config.apiUrl) {
      const stored = localStorage.getItem(STORAGE_KEY)
      console.debug('[prefs] no apiUrl, localStorage:', !!stored)
      if (stored) {
        preferences.value = JSON.parse(stored)
        savedSnapshot.value = stored
      }
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const authStore = useAuthStore()
      const token = await authStore.getToken()
      console.debug('[prefs] token:', token ? 'present' : 'NULL')
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = token

      const url = `${config.apiUrl}/api/preferences`
      console.debug('[prefs] fetching:', url)
      const response = await fetch(url, { headers })
      console.debug('[prefs] response status:', response.status)

      if (response.status === 404) {
        preferences.value = null
        savedSnapshot.value = null
        console.debug('[prefs] 404 — no preferences found')
        return
      }

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const data = await response.json()
      console.debug('[prefs] data received:', data)
      preferences.value = data
      savedSnapshot.value = JSON.stringify(data)
      console.debug('[prefs] preferences.value set:', !!preferences.value)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch preferences'
      console.error('[prefs] fetchPreferences failed:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function savePreferences(prefs: MealPreferences, week?: string) {
    const config = await getConfig()

    if (!config.apiUrl) {
      // Local dev: save to localStorage
      const json = JSON.stringify(prefs)
      localStorage.setItem(STORAGE_KEY, json)
      preferences.value = prefs
      savedSnapshot.value = json
      return
    }

    isSaving.value = true
    error.value = null

    try {
      const authStore = useAuthStore()
      const token = await authStore.getToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = token

      const response = await fetch(`${config.apiUrl}/api/preferences`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ ...prefs, week }),
      })

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      preferences.value = prefs
      savedSnapshot.value = JSON.stringify(prefs)

      // Clear meal plan cache so it re-fetches the regenerating plan
      const mealPlanStore = useMealPlanStore()
      mealPlanStore.clearCache()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save preferences'
      console.error('Failed to save preferences:', err)
      throw err
    } finally {
      isSaving.value = false
    }
  }

  return {
    preferences,
    savedSnapshot,
    isLoading,
    isSaving,
    error,
    fetchPreferences,
    savePreferences,
  }
})
