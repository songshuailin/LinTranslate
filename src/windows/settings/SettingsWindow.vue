<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { AppConfig } from '../../services/config/app-config'
import { loadConfig, saveConfig } from '../../services/config/config-storage'
import { defaultConfig } from '../../services/config/app-config'
import { translateTextStream } from '../../services/translator/text-translator'
import {
  getPermissionStatus,
  openAccessibilitySettings,
  openScreenRecordingSettings,
} from '../../services/tauri/commands'

type ModelsResponse = {
  data?: Array<{ id?: string } | string>
  models?: Array<{ id?: string } | string>
}

type PermissionKey = 'accessibility' | 'screenRecording'
type PermissionValue = 'granted' | 'denied' | 'unsupported' | 'unknown'

const config = ref<AppConfig>(JSON.parse(JSON.stringify(defaultConfig)))
const saving = ref(false)
const testResult = ref<string>('')
const providerBaseUrl = ref('')
const providerApiKey = ref('')
const loadingModels = ref(false)
const modelOptions = ref<string[]>([])
const translateInputText = ref('')
const translating = ref(false)
const translatedResult = ref('')
const targetLanguages = ['中文', 'English', '日本語', '한국어']
const appVersion = '0.1.0'
const permissionStatus = ref<Record<PermissionKey, PermissionValue>>({
  accessibility: 'unknown',
  screenRecording: 'unknown',
})
const loadingPermissions = ref(false)
let translationAbortController: AbortController | null = null

onMounted(async () => {
  config.value = await loadConfig()
  providerBaseUrl.value = config.value.textModel.baseUrl
  providerApiKey.value = config.value.textModel.apiKey
  modelOptions.value = getAvailableModels()
  await refreshPermissions()
})

onBeforeUnmount(() => {
  translationAbortController?.abort()
})

function getAvailableModels() {
  return Array.from(new Set([
    config.value.textModel.model,
    config.value.visionModel.model,
    ...modelOptions.value,
  ].filter(Boolean)))
}

function normalizeApiBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed)
    if (url.pathname === '' || url.pathname === '/') {
      url.pathname = '/v1'
      return url.toString().replace(/\/+$/, '')
    }
  } catch {
    // Keep non-standard local addresses as-is.
  }

  return trimmed
}

function getModelFetchBaseUrls(baseUrl: string) {
  const raw = baseUrl.trim().replace(/\/+$/, '')
  const normalized = normalizeApiBaseUrl(raw)
  return Array.from(new Set([normalized, raw].filter(Boolean)))
}

function syncProviderConfig() {
  const baseUrl = normalizeApiBaseUrl(providerBaseUrl.value)
  const apiKey = providerApiKey.value.trim()

  providerBaseUrl.value = baseUrl
  config.value.textModel.baseUrl = baseUrl
  config.value.textModel.apiKey = apiKey
  config.value.visionModel.baseUrl = baseUrl
  config.value.visionModel.apiKey = apiKey
}

function normalizeModelList(data: ModelsResponse): string[] {
  const rawModels = data.data || data.models || []
  return rawModels
    .map((item) => typeof item === 'string' ? item : item.id)
    .filter((id): id is string => Boolean(id))
}

async function fetchModels() {
  const candidateBaseUrls = getModelFetchBaseUrls(providerBaseUrl.value)

  if (candidateBaseUrls.length === 0) {
    testResult.value = '请先输入 API 地址'
    return
  }

  loadingModels.value = true
  try {
    testResult.value = '正在获取模型列表...'
    let lastError = ''
    let models: string[] = []
    let workingBaseUrl = ''
    const headers: Record<string, string> = {}
    const apiKey = providerApiKey.value.trim()
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`

    for (const baseUrl of candidateBaseUrls) {
      const resp = await fetch(`${baseUrl}/models`, {
        headers,
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        lastError = `${resp.status} - ${(data as { error?: { message?: string } }).error?.message || resp.statusText}`
        continue
      }

      models = normalizeModelList(await resp.json() as ModelsResponse)
      workingBaseUrl = baseUrl
      break
    }

    if (!workingBaseUrl) {
      testResult.value = `获取模型失败: ${lastError || '接口无响应'}`
      return
    }
    if (models.length === 0) {
      testResult.value = '获取成功，但没有返回可用模型'
      return
    }

    providerBaseUrl.value = workingBaseUrl
    syncProviderConfig()
    modelOptions.value = models
    if (!models.includes(config.value.textModel.model)) {
      config.value.textModel.model = models[0]
    }
    if (!models.includes(config.value.visionModel.model)) {
      config.value.visionModel.model = models[0]
    }

    testResult.value = `获取模型成功，共 ${models.length} 个`
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : '未知错误'
    if (errorMsg.includes('Load failed') || errorMsg.includes('NetworkError')) {
      testResult.value = `获取模型失败: 无法连接到 ${config.value.textModel.baseUrl}，请确认服务是否运行`
    } else {
      testResult.value = `获取模型失败: ${errorMsg}`
    }
  } finally {
    loadingModels.value = false
  }
}

async function refreshPermissions() {
  loadingPermissions.value = true
  try {
    const status = await getPermissionStatus()
    permissionStatus.value = {
      accessibility: normalizePermissionValue(status.accessibility),
      screenRecording: normalizePermissionValue(status.screenRecording),
    }
  } catch (e: unknown) {
    testResult.value = `权限检测失败: ${e instanceof Error ? e.message : '未知错误'}`
  } finally {
    loadingPermissions.value = false
  }
}

function normalizePermissionValue(value: string | undefined): PermissionValue {
  if (value === 'granted' || value === 'denied' || value === 'unsupported') return value
  return 'unknown'
}

function permissionLabel(value: PermissionValue) {
  const labels: Record<PermissionValue, string> = {
    granted: '已授权',
    denied: '未授权',
    unsupported: '不支持',
    unknown: '未知',
  }
  return labels[value]
}

async function openPermissionSettings(kind: PermissionKey) {
  try {
    if (kind === 'accessibility') {
      await openAccessibilitySettings()
    } else {
      await openScreenRecordingSettings()
    }
  } catch (e: unknown) {
    testResult.value = `打开系统设置失败: ${e instanceof Error ? e.message : '未知错误'}`
  }
}

async function closeSettingsWindow() {
  translationAbortController?.abort()
  emit('close')
}

async function handleSave() {
  saving.value = true
  try {
    syncProviderConfig()
    await saveConfig(config.value)
    testResult.value = '配置已保存'
    await closeSettingsWindow()
  } catch (e: unknown) {
    testResult.value = `保存失败: ${e instanceof Error ? e.message : '未知错误'}`
  } finally {
    saving.value = false
  }
}

async function handleTestTranslation() {
  const text = translateInputText.value.trim()
  if (!text) return

  translating.value = true
  translatedResult.value = ''
  testResult.value = '正在翻译...'

  try {
    syncProviderConfig()
    translationAbortController?.abort()
    translationAbortController = new AbortController()
    const stream = translateTextStream(config.value.textModel, {
      text,
      targetLanguage: config.value.targetLanguage || '中文',
    }, {
      signal: translationAbortController.signal,
    })

    for await (const delta of stream) {
      translatedResult.value += delta
    }

    testResult.value = '翻译完成'
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      testResult.value = '翻译已取消'
      return
    }

    testResult.value = `翻译失败: ${e instanceof Error ? e.message : '未知错误'}`
    translatedResult.value = ''
  } finally {
    translating.value = false
    translationAbortController = null
  }
}

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="settings-container">
    <header class="settings-header">
      <div>
        <h1 class="title">灵译设置</h1>
        <p class="subtitle">Local Bubble Translator</p>
      </div>
    </header>

    <main class="settings-content">
      <section class="section">
        <div class="section-header">
          <h2 class="section-title">翻译偏好</h2>
        </div>
        <div class="field-grid">
          <label class="field">
            <span class="field-label">目标语言</span>
            <input
              v-model="config.targetLanguage"
              list="target-language-options"
              class="input-field"
              placeholder="中文"
            />
            <datalist id="target-language-options">
              <option v-for="lang in targetLanguages" :key="lang" :value="lang" />
            </datalist>
          </label>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">权限</h2>
          <button class="btn btn-secondary" :disabled="loadingPermissions" @click="refreshPermissions">
            {{ loadingPermissions ? '检测中...' : '刷新' }}
          </button>
        </div>
        <div class="permission-list">
          <div class="permission-row">
            <div class="permission-info">
              <span class="permission-name">辅助功能</span>
              <span class="permission-note">授权 /Applications/灵译.app 后读取选中文本</span>
            </div>
            <span class="permission-badge" :class="`permission-${permissionStatus.accessibility}`">
              {{ permissionLabel(permissionStatus.accessibility) }}
            </span>
            <button class="btn btn-secondary permission-action" @click="openPermissionSettings('accessibility')">
              打开设置
            </button>
          </div>
          <div class="permission-row">
            <div class="permission-info">
              <span class="permission-name">屏幕录制</span>
              <span class="permission-note">用于截图翻译</span>
            </div>
            <span class="permission-badge" :class="`permission-${permissionStatus.screenRecording}`">
              {{ permissionLabel(permissionStatus.screenRecording) }}
            </span>
            <button class="btn btn-secondary permission-action" @click="openPermissionSettings('screenRecording')">
              打开设置
            </button>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">API 连接</h2>
          <button class="btn btn-secondary" :disabled="loadingModels" @click="fetchModels">
            {{ loadingModels ? '获取中...' : '获取模型' }}
          </button>
        </div>
        <div class="field-grid">
          <label class="field field-wide">
            <span class="field-label">API 地址</span>
            <input v-model="providerBaseUrl" class="input-field" placeholder="OpenAI-compatible /v1 地址" />
          </label>
          <label class="field field-wide">
            <span class="field-label">API Key</span>
            <input v-model="providerApiKey" class="input-field" placeholder="按服务要求填写" />
          </label>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">模型选择</h2>
        </div>
        <div class="field-grid">
          <label class="field">
            <span class="field-label">文本翻译模型</span>
            <select v-model="config.textModel.model" class="input-field">
              <option v-if="getAvailableModels().length === 0" disabled value="">请先获取模型</option>
              <option v-for="model in getAvailableModels()" :key="`text-${model}`" :value="model">{{ model }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">截图翻译模型</span>
            <select v-model="config.visionModel.model" class="input-field">
              <option v-if="getAvailableModels().length === 0" disabled value="">请先获取模型</option>
              <option v-for="model in getAvailableModels()" :key="`vision-${model}`" :value="model">{{ model }}</option>
            </select>
          </label>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">测试翻译</h2>
          <span class="language-pill">{{ config.targetLanguage || '中文' }}</span>
        </div>
        <textarea v-model="translateInputText" rows="3" class="input-field textarea" placeholder="输入要翻译的文本"></textarea>
        <div class="test-actions">
          <button class="btn btn-secondary" :disabled="!translateInputText.trim() || translating" @click="handleTestTranslation">
            {{ translating ? '翻译中...' : '测试翻译' }}
          </button>
        </div>
        <div v-if="translatedResult" class="translation-result">
          {{ translatedResult }}
        </div>
      </section>

      <div v-if="testResult" class="result-box" :class="{
        'result-success': testResult.includes('成功') || testResult.includes('完成') || testResult.includes('已保存'),
        'result-fail': testResult.includes('失败'),
        'result-info': !testResult.includes('成功') && !testResult.includes('完成') && !testResult.includes('已保存') && !testResult.includes('失败'),
      }">
        {{ testResult }}
      </div>
    </main>

    <footer class="settings-footer">
      <div v-if="testResult" class="footer-status" :class="{
        'footer-success': testResult.includes('成功') || testResult.includes('完成') || testResult.includes('已保存'),
        'footer-fail': testResult.includes('失败'),
      }">
        {{ testResult }}
      </div>
      <div v-else class="footer-version">版本 {{ appVersion }}</div>
      <button class="btn btn-primary" :disabled="saving" @click="handleSave">
        {{ saving ? '保存中...' : '保存配置' }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.settings-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  min-width: 0;
  background: #f4f5f7;
}

.settings-header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  height: 62px;
  padding: 12px 18px 10px;
  border-bottom: 1px solid #d8dde6;
  background: #fbfbfc;
}

.title {
  margin: 0;
  color: #14181f;
  font-size: 17px;
  font-weight: 700;
  line-height: 22px;
}

.subtitle {
  margin: 1px 0 0;
  color: #7b8494;
  font-size: 11px;
  line-height: 14px;
}

.settings-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 16px 18px;
}

.section {
  margin-bottom: 12px;
  padding: 14px;
  border: 1px solid #dfe4eb;
  border-radius: 8px;
  background: #ffffff;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.section-title {
  margin: 0;
  color: #202733;
  font-size: 13px;
  font-weight: 700;
  line-height: 18px;
}

.field-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px 12px;
}

.field {
  min-width: 0;
}

.field-wide {
  grid-column: 1 / -1;
}

.field-compact {
  max-width: 128px;
}

.field-label {
  display: block;
  margin-bottom: 5px;
  color: #596273;
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
}

.input-field {
  width: 100%;
  min-width: 0;
  height: 34px;
  padding: 7px 10px;
  border: 1px solid #cfd6df;
  border-radius: 8px;
  outline: none;
  background: #ffffff;
  color: #1f2937;
  font-size: 13px;
  line-height: 18px;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.input-field:focus {
  border-color: #3f7fcd;
  box-shadow: 0 0 0 3px rgba(63, 127, 205, 0.14);
}

.textarea {
  display: block;
  height: 74px;
  min-height: 74px;
  resize: none;
}

.test-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #cfd6df;
  border-radius: 8px;
  background: #ffffff;
  color: #202733;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  cursor: pointer;
  white-space: nowrap;
}

.btn:hover:not(:disabled) {
  background: #f2f5f8;
}

.btn-primary {
  border-color: #2463ad;
  background: #2463ad;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: #1d5597;
}

.btn-secondary {
  min-width: 76px;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.language-pill {
  flex: 0 0 auto;
  max-width: 160px;
  overflow: hidden;
  padding: 3px 8px;
  border-radius: 999px;
  background: #eef5ee;
  color: #2f6d3d;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.permission-list {
  display: grid;
  gap: 8px;
}

.permission-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  min-height: 44px;
}

.permission-info {
  min-width: 0;
}

.permission-name {
  display: block;
  color: #202733;
  font-size: 13px;
  font-weight: 700;
  line-height: 18px;
}

.permission-note {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  color: #7b8494;
  font-size: 11px;
  line-height: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.permission-badge {
  min-width: 58px;
  padding: 3px 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  white-space: nowrap;
}

.permission-granted {
  border-color: #b9dfc0;
  background: #edf8ef;
  color: #236b33;
}

.permission-denied,
.permission-unknown {
  border-color: #f1c1c1;
  background: #fff0f0;
  color: #9d2c2c;
}

.permission-unsupported {
  border-color: #d7dce5;
  background: #f3f5f8;
  color: #596273;
}

.permission-action {
  min-width: 76px;
}

.result-box {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 12px;
  line-height: 18px;
}

.result-success {
  border-color: #b9dfc0;
  background: #edf8ef;
  color: #236b33;
}

.result-fail {
  border-color: #f1c1c1;
  background: #fff0f0;
  color: #9d2c2c;
}

.result-info {
  border-color: #bcd4f1;
  background: #eef6ff;
  color: #285f9f;
}

.translation-result {
  max-height: 120px;
  overflow: auto;
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid #c9e1cd;
  border-radius: 8px;
  background: #f6fbf6;
  color: #1f2937;
  font-size: 13px;
  line-height: 20px;
  white-space: pre-wrap;
}

.settings-footer {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 10px 16px 12px;
  border-top: 1px solid #d8dde6;
  background: rgba(251, 251, 252, 0.96);
}

.footer-status {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: #596273;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.footer-version {
  flex: 1 1 auto;
  min-width: 0;
  color: #7b8494;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.footer-success {
  color: #236b33;
}

.footer-fail {
  color: #9d2c2c;
}

@media (max-width: 480px) {
  .field-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .permission-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .permission-action {
    grid-column: 1 / -1;
    width: 100%;
  }

  .field-compact {
    max-width: none;
  }
}
</style>
