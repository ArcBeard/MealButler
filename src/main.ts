import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@/assets/index.css'
import App from './App.vue'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'
import { useMealPlanStore } from '@/stores/mealPlan'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// Initialize auth, then check for existing meal plan before mounting
const authStore = useAuthStore()
authStore
  .initialize()
  .then(() => {
    if (authStore.isAuthenticated) {
      return useMealPlanStore().initialize()
    }
  })
  .finally(() => {
    app.mount('#app')
  })
