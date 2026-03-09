import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useMealPlanStore } from '@/stores/mealPlan'
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
      path: '/recipes',
      name: 'recipes',
      component: () => import('@/views/RecipeListView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/recipe/:weekStart/:dayIndex/:mealType',
      name: 'recipe-detail',
      component: () => import('@/views/RecipeView.vue'),
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
  const { hasCurrentWeekPlan } = useMealPlanStore()
  const prefStore = usePreferencesStore()

  // Returning user with plan → calendar
  if (to.path === '/' && hasCurrentWeekPlan) {
    return '/calendar'
  }

  // Protect routes: need either a plan or saved preferences
  if (to.path !== '/') {
    if (!hasCurrentWeekPlan && !prefStore.preferences) {
      return '/'
    }
  }

  // Auth guard for protected routes
  if (to.meta.requiresAuth) {
    const authStore = useAuthStore()
    // Skip auth check when auth is not configured (local dev)
    if (authStore.isAuthConfigured && !authStore.isAuthenticated) {
      return '/'
    }
  }
})

export default router
