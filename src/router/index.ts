import { createRouter, createWebHistory } from 'vue-router'
import { useAgentChatStore } from '@/stores/agentChat'
import { useAuthStore } from '@/stores/auth'
import { useMealPlanStore } from '@/stores/mealPlan'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'agent',
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
      component: () => import('@/views/RecipeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/recipe-list',
      name: 'recipe-list',
      component: () => import('@/views/RecipeListView.vue'),
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
  const { isComplete } = useAgentChatStore()

  // Authenticated user with an existing meal plan: skip chat, go to calendar
  if (to.path === '/' && hasCurrentWeekPlan) {
    return '/calendar'
  }

  // Allow access to protected routes if chat is complete OR a meal plan exists
  if (to.path !== '/') {
    if (!isComplete && !hasCurrentWeekPlan) {
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
