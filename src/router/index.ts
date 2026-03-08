import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
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

export default router
