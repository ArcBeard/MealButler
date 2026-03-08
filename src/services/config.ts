interface AppConfig {
  apiUrl: string
}

let cachedConfig: AppConfig | null = null

export async function getConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig

  try {
    const resp = await fetch('/config.json')
    if (!resp.ok) throw new Error(`Config fetch failed: ${resp.status}`)
    cachedConfig = await resp.json()
    return cachedConfig!
  } catch {
    // Fallback for local development (no config.json available)
    return { apiUrl: '' }
  }
}
