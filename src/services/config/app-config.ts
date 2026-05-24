export type AppConfig = {
  targetLanguage: string
  textModel: OpenAICompatibleModelConfig
  visionModel: OpenAICompatibleModelConfig
  hotkeys: {
    translateSelection: string
    translateScreenshot: string
  }
  popup: {
    defaultWidth: number
    defaultMaxHeight: number
    closeOnBlur: boolean
  }
}

export type OpenAICompatibleModelConfig = {
  name: string
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  stream: boolean
}

export const defaultConfig: AppConfig = {
  targetLanguage: '中文',
  textModel: {
    name: 'Text Model',
    baseUrl: '',
    apiKey: '',
    model: '',
    temperature: 0.2,
    stream: true,
  },
  visionModel: {
    name: 'Vision Model',
    baseUrl: '',
    apiKey: '',
    model: '',
    temperature: 0.2,
    stream: true,
  },
  hotkeys: {
    translateSelection: 'Command+E',
    translateScreenshot: 'Command+R',
  },
  popup: {
    defaultWidth: 420,
    defaultMaxHeight: 520,
    closeOnBlur: true,
  },
}
