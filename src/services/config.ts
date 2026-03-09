interface CognitoConfig {
  userPoolId: string
  clientId: string
  domain: string
  region: string
}

interface AppConfig {
  apiUrl: string
  cognito?: CognitoConfig
}

let cachedConfig: AppConfig | null = null

export async function getConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig

  try {
    const resp = await fetch('/config.json')
    if (!resp.ok) throw new Error(`Config fetch failed: ${resp.status}`)
    const config: AppConfig = await resp.json()
    // Strip trailing slash to avoid double-slash in API URLs
    if (config.apiUrl) config.apiUrl = config.apiUrl.replace(/\/+$/, '')
    cachedConfig = config
    return cachedConfig!
  } catch {
    // Fallback for local development (no config.json available)
    return { apiUrl: '' }
  }
}
