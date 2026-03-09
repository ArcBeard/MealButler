import { describe, it, expect, beforeEach } from 'vitest'
import { createRouter, createWebHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'

// Stub view components
const Stub = { template: '<div />' }

function createTestRouter(): Router {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'onboarding', component: Stub },
      { path: '/calendar', name: 'calendar', component: Stub, meta: { requiresAuth: true } },
      { path: '/family-settings', name: 'family-settings', component: Stub, meta: { requiresAuth: true } },
    ],
  })

  // Same guard as production
  router.beforeEach((to) => {
    const authStore = useAuthStore()
    const prefStore = usePreferencesStore()

    if (to.path === '/' && prefStore.preferences) {
      return '/calendar'
    }

    if (to.meta.requiresAuth && authStore.isAuthConfigured && !authStore.isAuthenticated) {
      return '/'
    }
  })

  return router
}

describe('router guard', () => {
  let router: Router

  beforeEach(() => {
    setActivePinia(createPinia())
    router = createTestRouter()
  })

  it('allows new user (no preferences) to stay on /', async () => {
    await router.push('/')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('redirects to /calendar when preferences exist', async () => {
    const prefStore = usePreferencesStore()
    // Simulate preferences loaded from API
    prefStore.preferences = {
      household: '2 adults',
      dietary: ['none'],
      budget: 'moderate',
      skill: 'intermediate',
      time: '30',
      cuisine: ['any'],
      notes: '',
      preferredSites: [],
    } as any

    await router.push('/')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/calendar')
  })

  it('blocks unauthenticated user from /calendar when auth is configured', async () => {
    const authStore = useAuthStore()
    authStore.isAuthConfigured = true
    // user is null → isAuthenticated is false

    await router.push('/calendar')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('allows authenticated user to access /calendar', async () => {
    const authStore = useAuthStore()
    authStore.isAuthConfigured = true
    authStore.user = { sub: 'test-sub', email: 'test@test.com' } as any

    await router.push('/calendar')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/calendar')
  })

  it('allows unauthenticated user to access /calendar when auth is NOT configured', async () => {
    const authStore = useAuthStore()
    authStore.isAuthConfigured = false

    await router.push('/calendar')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/calendar')
  })

  it('redirects authenticated user with preferences from / to /calendar', async () => {
    const authStore = useAuthStore()
    const prefStore = usePreferencesStore()
    authStore.isAuthConfigured = true
    authStore.user = { sub: 'test-sub', email: 'test@test.com' } as any
    prefStore.preferences = { household: '2 adults' } as any

    await router.push('/')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/calendar')
  })

  it('blocks unauthenticated user from /family-settings', async () => {
    const authStore = useAuthStore()
    authStore.isAuthConfigured = true

    await router.push('/family-settings')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/')
  })
})
