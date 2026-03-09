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

  /** Clear local Amplify auth data and reset state */
  function clearLocalSession() {
    user.value = null
    // Remove Amplify's cached tokens from localStorage
    const keysToRemove = Object.keys(localStorage).filter(
      (k) => k.startsWith('CognitoIdentityServiceProvider') || k.startsWith('amplify-'),
    )
    keysToRemove.forEach((k) => localStorage.removeItem(k))
  }

  async function initialize() {
    isLoading.value = true
    try {
      const configured = await configureAuth()
      isAuthConfigured.value = configured
      if (!configured) return

      // Check if user is already authenticated (e.g. after OAuth redirect)
      const currentUser = await getAuthUser()
      if (currentUser) {
        // Verify the session is still valid by getting a token
        const token = await getIdToken()
        if (!token) {
          // Session expired — clear stale state and redirect
          clearLocalSession()
          loginWithHostedUI().catch(() => {
            // If redirect fails, user lands on unauthenticated home
          })
          return
        }

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
      // If init fails entirely, clear stale state so UI reflects reality
      clearLocalSession()
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
    try {
      await logout()
    } catch {
      // Global sign out can fail with expired session — clear locally
    }
    clearLocalSession()
  }

  async function getToken(): Promise<string | null> {
    const token = await getIdToken()
    if (!token && user.value) {
      // Session expired mid-use — clear and redirect
      clearLocalSession()
      loginWithHostedUI().catch(() => {})
      return null
    }
    return token
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
