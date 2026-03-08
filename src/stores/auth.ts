import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  configureAuth,
  loginWithGoogle,
  loginWithHostedUI,
  logout,
  getAuthUser,
  getIdToken,
  getUserAttributes,
} from '@/services/auth'

interface AuthUser {
  sub: string
  email: string
  givenName?: string
  picture?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const isLoading = ref(false)
  const isAuthConfigured = ref(false)

  const isAuthenticated = computed(() => !!user.value)

  const userInitials = computed(() => {
    if (!user.value) return 'U'
    if (user.value.givenName) return user.value.givenName[0]!.toUpperCase()
    if (user.value.email) return user.value.email[0]!.toUpperCase()
    return 'U'
  })

  async function initialize() {
    isLoading.value = true
    try {
      const configured = await configureAuth()
      isAuthConfigured.value = configured
      if (!configured) return

      // Check if user is already authenticated (e.g. after OAuth redirect)
      const currentUser = await getAuthUser()
      if (currentUser) {
        const attrs = await getUserAttributes()
        user.value = {
          sub: currentUser.userId,
          email: attrs?.email ?? '',
          givenName: attrs?.given_name,
          picture: attrs?.picture,
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function signInWithGoogle() {
    await loginWithGoogle()
  }

  async function signInWithHostedUI() {
    await loginWithHostedUI()
  }

  async function signOut() {
    await logout()
    user.value = null
  }

  async function getToken(): Promise<string | null> {
    return getIdToken()
  }

  return {
    user,
    isLoading,
    isAuthConfigured,
    isAuthenticated,
    userInitials,
    initialize,
    signInWithGoogle,
    signInWithHostedUI,
    signOut,
    getToken,
  }
})
