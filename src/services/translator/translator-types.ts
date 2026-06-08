export type TranslateTextInput = { text: string; targetLanguage: string }
export type TranslateImageInput = { imageBase64: string; targetLanguage: string }
export type TranslationStreamOptions = { signal?: AbortSignal }
export type TranslationMode = 'selection' | 'screenshot'
export type TranslationStatus = 'idle' | 'streaming' | 'done' | 'error'

export type TranslationPopup = {
  id: string
  mode: TranslationMode
  sourceText?: string
  imageBase64?: string
  translatedText: string
  targetLanguage: string
  status: TranslationStatus
  errorMessage?: string
  position: { x: number; y: number }
  createdAt: number
  isPinned: boolean
}
