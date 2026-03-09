import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@/assets/index.css'
import App from './App.vue'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// Initialize stores BEFORE installing router so the guard sees populated state
const authStore = useAuthStore()
await authStore.initialize()

if (authStore.isAuthenticated) {
  await usePreferencesStore().fetchPreferences()
}

app.use(router)
app.mount('#app')
