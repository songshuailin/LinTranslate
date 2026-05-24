import { AppConfig, defaultConfig } from './app-config'
import { loadAppConfig, saveAppConfig } from '../tauri/commands'

const CONFIG_KEY = 'local-bubble-translator-config'

function cloneDefaultConfig(): AppConfig {
  return JSON.parse(JSON.stringify(defaultConfig)) as AppConfig
}

function mergeWithDefault(config: Partial<AppConfig>): AppConfig {
  return {
    ...cloneDefaultConfig(),
    ...config,
    textModel: { ...defaultConfig.textModel, ...config.textModel },
    visionModel: { ...defaultConfig.visionModel, ...config.visionModel },
    hotkeys: { ...defaultConfig.hotkeys, ...config.hotkeys },
    popup: { ...defaultConfig.popup, ...config.popup },
  }
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const stored = await loadAppConfig()
    if (stored) {
      return mergeWithDefault(stored)
    }
  } catch (e) {
    console.warn('[config] Falling back to default config:', e)
    return cloneDefaultConfig()
  }

  const legacyConfig = loadLegacyConfig()
  if (legacyConfig) {
    await saveConfig(legacyConfig)
    localStorage.removeItem(CONFIG_KEY)
    return legacyConfig
  }

  return cloneDefaultConfig()
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await saveAppConfig(config)
}

function loadLegacyConfig(): AppConfig | null {
  try {
    const stored = localStorage.getItem(CONFIG_KEY)
    if (!stored) return null

    return mergeWithDefault(JSON.parse(stored) as Partial<AppConfig>)
  } catch {
    localStorage.removeItem(CONFIG_KEY)
    return null
  }
}
