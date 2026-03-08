import { createRouter, createWebHistory } from 'vue-router'
import { useAgentChatStore } from '@/stores/agentChat'
import { useAuthStore } from '@/stores/auth'

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
  if (to.path !== '/') {
    const { isComplete } = useAgentChatStore()
    if (!isComplete) {
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
