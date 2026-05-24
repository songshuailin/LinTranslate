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
  clearLegacyConfig()

  try {
    const stored = await loadAppConfig()
    if (stored) {
      return mergeWithDefault(stored)
    }
  } catch (e) {
    console.warn('[config] Falling back to default config:', e)
    return cloneDefaultConfig()
  }

  return cloneDefaultConfig()
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await saveAppConfig(config)
}

function clearLegacyConfig(): void {
  try {
    localStorage.removeItem(CONFIG_KEY)
  } catch {
    // Ignore storage access errors; local app config remains the source of truth.
  }
}
