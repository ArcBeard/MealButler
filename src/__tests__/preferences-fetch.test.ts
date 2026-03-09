import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePreferencesStore } from '@/stores/preferences'
import { useAuthStore } from '@/stores/auth'

// Mock getConfig
vi.mock('@/services/config', () => ({
  getConfig: vi.fn(),
}))

// Mock auth service (prevent Amplify from loading)
vi.mock('@/services/auth', () => ({
  configureAuth: vi.fn().mockResolvedValue(false),
  loginWithGoogle: vi.fn(),
  loginWithHostedUI: vi.fn(),
  logout: vi.fn(),
  getAuthUser: vi.fn().mockResolvedValue(null),
  getIdToken: vi.fn().mockResolvedValue('mock-token'),
  getUserAttributesFromToken: vi.fn().mockResolvedValue(null),
}))

// Mock mealPlan store dependency
vi.mock('@/stores/mealPlan', () => ({
  useMealPlanStore: vi.fn(() => ({
    clearCache: vi.fn(),
    initialize: vi.fn(),
  })),
}))

import { getConfig } from '@/services/config'

const mockPreferences = {
  household: '2 adults, 3 kids',
  dietary: ['none'],
  budget: 'moderate',
  skill: 'intermediate',
  time: '30',
  cuisine: ['any'],
  notes: '',
  preferredSites: ['AllRecipes'],
}

describe('fetchPreferences', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('sets preferences when API returns 200', async () => {
    vi.mocked(getConfig).mockResolvedValue({ apiUrl: 'https://api.example.com' })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockPreferences),
    })

    const authStore = useAuthStore()
    // Simulate authenticated user
    authStore.user = { sub: 'test', email: 'test@test.com' } as any
    // Mock getToken to return a token
    authStore.getToken = vi.fn().mockResolvedValue('mock-id-token')

    const prefStore = usePreferencesStore()
    await prefStore.fetchPreferences()

    expect(prefStore.preferences).toEqual(mockPreferences)
    expect(prefStore.preferences).not.toBeNull()
  })

  it('leaves preferences null when API returns 404', async () => {
    vi.mocked(getConfig).mockResolvedValue({ apiUrl: 'https://api.example.com' })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    })

    const authStore = useAuthStore()
    authStore.user = { sub: 'test', email: 'test@test.com' } as any
    authStore.getToken = vi.fn().mockResolvedValue('mock-id-token')

    const prefStore = usePreferencesStore()
    await prefStore.fetchPreferences()

    expect(prefStore.preferences).toBeNull()
  })

  it('leaves preferences null when getToken returns null (expired session)', async () => {
    vi.mocked(getConfig).mockResolvedValue({ apiUrl: 'https://api.example.com' })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Missing authentication' }),
    })

    const authStore = useAuthStore()
    authStore.user = { sub: 'test', email: 'test@test.com' } as any
    // Token is null — session expired
    authStore.getToken = vi.fn().mockResolvedValue(null)

    const prefStore = usePreferencesStore()
    await prefStore.fetchPreferences()

    // 400 is not 404, so it throws, caught internally → preferences stays null
    expect(prefStore.preferences).toBeNull()
    expect(prefStore.error).toBe('API error: 400')
  })

  it('leaves preferences null when fetch throws (network error)', async () => {
    vi.mocked(getConfig).mockResolvedValue({ apiUrl: 'https://api.example.com' })
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const authStore = useAuthStore()
    authStore.user = { sub: 'test', email: 'test@test.com' } as any
    authStore.getToken = vi.fn().mockResolvedValue('mock-id-token')

    const prefStore = usePreferencesStore()
    await prefStore.fetchPreferences()

    expect(prefStore.preferences).toBeNull()
    expect(prefStore.error).toBe('Network error')
  })

  it('full flow: auth init → fetch prefs → router redirect', async () => {
    vi.mocked(getConfig).mockResolvedValue({ apiUrl: 'https://api.example.com' })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockPreferences),
    })

    const authStore = useAuthStore()
    authStore.isAuthConfigured = true
    authStore.user = { sub: 'test', email: 'test@test.com' } as any
    authStore.getToken = vi.fn().mockResolvedValue('mock-id-token')

    // Simulate the main.ts flow
    const isAuthenticated = !!authStore.user
    expect(isAuthenticated).toBe(true)

    const prefStore = usePreferencesStore()
    await prefStore.fetchPreferences()

    // This is what the router guard checks
    expect(prefStore.preferences).not.toBeNull()
    expect(!!prefStore.preferences).toBe(true)
  })
})
