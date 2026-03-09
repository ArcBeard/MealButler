import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  configureAuth,
  loginWithGoogle,
  loginWithHostedUI,
  logout,
  getAuthUser,
  getIdToken,
  getUserAttributesFromToken,
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
    console.debug('[AuthStore] initialize() start, URL:', window.location.href)
    // Log URL params that Amplify uses for OAuth code exchange
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.has('code')) {
      console.debug('[AuthStore] OAuth code detected in URL:', {
        code: urlParams.get('code')?.substring(0, 10) + '...',
        state: urlParams.get('state')?.substring(0, 10) + '...',
      })
    }
    if (urlParams.has('error')) {
      console.error('[AuthStore] OAuth error in URL:', {
        error: urlParams.get('error'),
        errorDescription: urlParams.get('error_description'),
      })
    }

    isLoading.value = true
    try {
      const configured = await configureAuth()
      isAuthConfigured.value = configured
      if (!configured) {
        console.debug('[AuthStore] Auth not configured, skipping')
        return
      }

      // Check if user is already authenticated (e.g. after OAuth redirect)
      console.debug('[AuthStore] Checking for existing user...')
      const currentUser = await getAuthUser()
      if (currentUser) {
        console.debug('[AuthStore] User found, verifying session...')
        // Verify the session is still valid by getting a token
        const token = await getIdToken()
        if (!token) {
          console.debug('[AuthStore] Session expired, clearing and redirecting')
          // Session expired — clear stale state and redirect
          clearLocalSession()
          loginWithHostedUI().catch(() => {
            // If redirect fails, user lands on unauthenticated home
          })
          return
        }

        // Use ID token claims directly (avoids 400 from fetchUserAttributes needing admin scope)
        const attrs = await getUserAttributesFromToken()
        user.value = {
          sub: currentUser.userId,
          email: attrs?.email ?? '',
          givenName: attrs?.given_name,
          picture: attrs?.picture,
        }
        console.debug('[AuthStore] Authenticated as:', { sub: user.value.sub, email: user.value.email })
      } else {
        console.debug('[AuthStore] No existing user found')
      }
    } catch (error) {
      console.error('[AuthStore] initialization error:', error)
      // If init fails entirely, clear stale state so UI reflects reality
      clearLocalSession()
    } finally {
      isLoading.value = false
      console.debug('[AuthStore] initialize() complete, isAuthenticated:', !!user.value)
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
