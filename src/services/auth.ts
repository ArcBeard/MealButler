import { Amplify } from 'aws-amplify'
import {
  signInWithRedirect,
  signOut as amplifySignOut,
  getCurrentUser,
  fetchAuthSession,
} from 'aws-amplify/auth'
import { getConfig } from '@/services/config'

let configured = false

/** Initialize Amplify Auth from runtime config.json. No-op if cognito config is absent. */
export async function configureAuth(): Promise<boolean> {
  if (configured) return true

  const config = await getConfig()
  if (!config.cognito) {
    console.debug('[Auth] No cognito config found, skipping auth setup')
    return false
  }

  const { userPoolId, clientId, domain, region } = config.cognito
  const oauthDomain = `${domain}.auth.${region}.amazoncognito.com`
  const redirectSignIn = window.location.origin + '/'
  const redirectSignOut = window.location.origin + '/'

  console.debug('[Auth] Configuring Amplify:', {
    userPoolId,
    clientId,
    oauthDomain,
    redirectSignIn,
    redirectSignOut,
    currentUrl: window.location.href,
    origin: window.location.origin,
  })

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId: clientId,
        loginWith: {
          oauth: {
            domain: oauthDomain,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [redirectSignIn],
            redirectSignOut: [redirectSignOut],
            responseType: 'code',
          },
        },
      },
    },
  })

  configured = true
  return true
}

export function loginWithGoogle() {
  console.debug('[Auth] Initiating Google sign-in redirect')
  return signInWithRedirect({ provider: 'Google' })
}

export function loginWithHostedUI() {
  console.debug('[Auth] Initiating Hosted UI sign-in redirect')
  return signInWithRedirect()
}

export async function logout() {
  console.debug('[Auth] Signing out globally')
  return amplifySignOut({ global: true })
}

export async function getAuthUser() {
  try {
    const user = await getCurrentUser()
    console.debug('[Auth] getCurrentUser:', user ? { userId: user.userId, username: user.username } : null)
    return user
  } catch (err) {
    console.debug('[Auth] getCurrentUser failed:', err)
    return null
  }
}

export async function getIdToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession()
    const token = session.tokens?.idToken?.toString() ?? null
    console.debug('[Auth] fetchAuthSession:', {
      hasTokens: !!session.tokens,
      hasIdToken: !!token,
      tokenPrefix: token ? token.substring(0, 20) + '...' : null,
    })
    return token
  } catch (err) {
    console.debug('[Auth] fetchAuthSession failed:', err)
    return null
  }
}

/** Extract user attributes from the ID token JWT payload (no extra scopes needed). */
export async function getUserAttributesFromToken(): Promise<Record<string, string> | null> {
  try {
    const session = await fetchAuthSession()
    const payload = session.tokens?.idToken?.payload
    if (!payload) return null
    const attrs: Record<string, string> = {}
    if (payload.email) attrs.email = String(payload.email)
    if (payload.given_name) attrs.given_name = String(payload.given_name)
    if (payload.picture) attrs.picture = String(payload.picture)
    console.debug('[Auth] getUserAttributesFromToken:', attrs)
    return attrs
  } catch (err) {
    console.debug('[Auth] getUserAttributesFromToken failed:', err)
    return null
  }
}
