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
    const config = await getConfig()

    if (!config.apiUrl) {
      // Local dev: load from localStorage
      const stored = localStorage.getItem(STORAGE_KEY)
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
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = token

      const response = await fetch(`${config.apiUrl}/api/preferences`, { headers })

      if (response.status === 404) {
        preferences.value = null
        savedSnapshot.value = null
        return
      }

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const data = await response.json()
      preferences.value = data
      savedSnapshot.value = JSON.stringify(data)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch preferences'
      console.error('Failed to fetch preferences:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function savePreferences(prefs: MealPreferences) {
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
        body: JSON.stringify(prefs),
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
