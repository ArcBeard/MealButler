import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getConfig } from '@/services/config'
import { useAuthStore } from '@/stores/auth'
import type { Recipe } from '@/types/meals'

export interface FavoriteEntry {
  recipeId: number
  title: string
  imageUrl?: string
  cuisines: string[]
}

const STORAGE_KEY = 'mealapp-favorites'

export const useFavoritesStore = defineStore('favorites', () => {
  const favorites = ref<Map<number, FavoriteEntry>>(new Map())
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  function isFavorite(recipeId: number): boolean {
    return favorites.value.has(recipeId)
  }

  async function fetchFavorites() {
    const config = await getConfig()

    if (!config.apiUrl) {
      // Local dev: load from localStorage
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const entries: FavoriteEntry[] = JSON.parse(stored)
        const map = new Map<number, FavoriteEntry>()
        for (const entry of entries) {
          map.set(entry.recipeId, entry)
        }
        favorites.value = map
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

      const response = await fetch(`${config.apiUrl}/api/favorites`, { headers })

      if (response.status === 404) {
        favorites.value = new Map()
        return
      }

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const data: FavoriteEntry[] = await response.json()
      const map = new Map<number, FavoriteEntry>()
      for (const entry of data) {
        map.set(entry.recipeId, entry)
      }
      favorites.value = map
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch favorites'
      console.error('Failed to fetch favorites:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function toggleFavorite(recipe: Recipe) {
    const recipeId = recipe.spoonacularId
    const wasLiked = isFavorite(recipeId)
    const config = await getConfig()

    // Optimistic update
    if (wasLiked) {
      favorites.value.delete(recipeId)
    } else {
      favorites.value.set(recipeId, {
        recipeId,
        title: recipe.title,
        imageUrl: recipe.imageUrl,
        cuisines: recipe.cuisines,
      })
    }
    // Trigger reactivity
    favorites.value = new Map(favorites.value)

    if (!config.apiUrl) {
      // Local dev: persist to localStorage
      const entries = Array.from(favorites.value.values())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
      return
    }

    try {
      const authStore = useAuthStore()
      const token = await authStore.getToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = token

      if (wasLiked) {
        const response = await fetch(`${config.apiUrl}/api/favorites/${recipeId}`, {
          method: 'DELETE',
          headers,
        })
        if (!response.ok) throw new Error(`API error: ${response.status}`)
      } else {
        const response = await fetch(`${config.apiUrl}/api/favorites`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            recipeId,
            title: recipe.title,
            imageUrl: recipe.imageUrl,
            cuisines: recipe.cuisines,
          }),
        })
        if (!response.ok) throw new Error(`API error: ${response.status}`)
      }
    } catch (err) {
      // Revert optimistic update on failure
      if (wasLiked) {
        favorites.value.set(recipeId, {
          recipeId,
          title: recipe.title,
          imageUrl: recipe.imageUrl,
          cuisines: recipe.cuisines,
        })
      } else {
        favorites.value.delete(recipeId)
      }
      favorites.value = new Map(favorites.value)
      error.value = err instanceof Error ? err.message : 'Failed to toggle favorite'
      console.error('Failed to toggle favorite:', err)
    }
  }

  return {
    favorites,
    isLoading,
    error,
    isFavorite,
    fetchFavorites,
    toggleFavorite,
  }
})
