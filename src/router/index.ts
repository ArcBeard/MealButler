import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'onboarding',
      component: () => import('@/views/AgentChatView.vue'),
    },
    {
      path: '/calendar',
      name: 'calendar',
      component: () => import('@/views/CalendarView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/family-settings',
      name: 'family-settings',
      component: () => import('@/views/FamilySettingsView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  const prefStore = usePreferencesStore()

  console.debug('[router] beforeEach to:', to.path, {
    isAuthenticated: authStore.isAuthenticated,
    isAuthConfigured: authStore.isAuthConfigured,
    hasPreferences: !!prefStore.preferences,
    preferences: prefStore.preferences,
    requiresAuth: to.meta.requiresAuth,
  })

  // Has preferences → go to calendar
  if (to.path === '/' && prefStore.preferences) {
    console.debug('[router] redirecting / → /calendar (has preferences)')
    return '/calendar'
  }

  // Auth guard
  if (to.meta.requiresAuth && authStore.isAuthConfigured && !authStore.isAuthenticated) {
    console.debug('[router] blocking', to.path, '→ / (not authenticated)')
    return '/'
  }
})

export default router
