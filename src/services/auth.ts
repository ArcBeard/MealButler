import { Amplify } from 'aws-amplify'
import {
  signInWithRedirect,
  signOut as amplifySignOut,
  getCurrentUser,
  fetchAuthSession,
  fetchUserAttributes,
} from 'aws-amplify/auth'
import { getConfig } from '@/services/config'

let configured = false

/** Initialize Amplify Auth from runtime config.json. No-op if cognito config is absent. */
export async function configureAuth(): Promise<boolean> {
  if (configured) return true

  const config = await getConfig()
  if (!config.cognito) return false

  const { userPoolId, clientId, domain, region } = config.cognito

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId: clientId,
        loginWith: {
          oauth: {
            domain: `${domain}.auth.${region}.amazoncognito.com`,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [window.location.origin + '/'],
            redirectSignOut: [window.location.origin + '/'],
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
  return signInWithRedirect({ provider: 'Google' })
}

export function loginWithHostedUI() {
  return signInWithRedirect()
}

export async function logout() {
  return amplifySignOut({ global: true })
}

export async function getAuthUser() {
  try {
    return await getCurrentUser()
  } catch {
    return null
  }
}

export async function getIdToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession()
    return session.tokens?.idToken?.toString() ?? null
  } catch {
    return null
  }
}

export async function getUserAttributes() {
  try {
    return await fetchUserAttributes()
  } catch {
    return null
  }
}
