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
console.debug('[App] Starting initialization, URL:', window.location.href)
const authStore = useAuthStore()
authStore
  .initialize()
  .then(() => {
    console.debug('[App] Auth initialized, isAuthenticated:', authStore.isAuthenticated)
    if (authStore.isAuthenticated) {
      return useMealPlanStore().initialize()
    }
  })
  .finally(() => {
    console.debug('[App] Mounting app')
    app.mount('#app')
  })
