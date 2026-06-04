import type { OpenAICompatibleModelConfig } from '../config/app-config'
import type { TranslateTextInput, TranslationStreamOptions } from './translator-types'
import { buildApiErrorMessage } from './api-errors'
import { buildNaturalTranslationRules } from './translation-prompts'

export function buildTextTranslateSystemPrompt(targetLanguage: string): string {
  return `你是一个专业翻译引擎。

任务：将用户提供的文本翻译成${targetLanguage}。

${buildNaturalTranslationRules(targetLanguage)}`.trim()
}

export async function* translateTextStream(
  config: OpenAICompatibleModelConfig,
  input: TranslateTextInput,
  options: TranslationStreamOptions = {},
): AsyncGenerator<string> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`

  const body = {
    model: config.model,
    stream: true,
    temperature: config.temperature ?? 0.2,
    messages: [
      { role: 'system', content: buildTextTranslateSystemPrompt(input.targetLanguage) },
      { role: 'user', content: input.text },
    ],
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const apiKey = config.apiKey.trim()
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  })

  if (!response.ok) throw new Error(await buildApiErrorMessage('文本翻译接口错误', response))
  if (!response.body) throw new Error('Translation API response body is empty')

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch { /* ignore incomplete SSE fragments */ }
    }
  }
}
