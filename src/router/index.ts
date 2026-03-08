import { createRouter, createWebHistory } from 'vue-router'
import { useAgentChatStore } from '@/stores/agentChat'

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
    },
    {
      path: '/recipes',
      name: 'recipes',
      component: () => import('@/views/RecipeView.vue'),
    },
    {
      path: '/recipe-list',
      name: 'recipe-list',
      component: () => import('@/views/RecipeListView.vue'),
    },
    {
      path: '/family-settings',
      name: 'family-settings',
      component: () => import('@/views/FamilySettingsView.vue'),
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
})

export default router
