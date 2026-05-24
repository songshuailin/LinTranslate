<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { AppConfig } from '../../services/config/app-config'
import { loadConfig, saveConfig } from '../../services/config/config-storage'
import { defaultConfig } from '../../services/config/app-config'
import { translateTextStream } from '../../services/translator/text-translator'
import {
  getPermissionStatus,
  openGithubReleases,
  openAccessibilitySettings,
  openScreenRecordingSettings,
} from '../../services/tauri/commands'
import { getVersion } from '@tauri-apps/api/app'

type ModelsResponse = {
  data?: Array<{ id?: string } | string>
  models?: Array<{ id?: string } | string>
}

type PermissionKey = 'accessibility' | 'screenRecording'
type PermissionValue = 'granted' | 'denied' | 'unsupported' | 'unknown'
type ReleaseResponse = {
  tag_name?: string
  html_url?: string
  draft?: boolean
  prerelease?: boolean
}

const GITHUB_LATEST_RELEASE_API = 'https://api.github.com/repos/songshuailin/LinTranslate/releases/latest'

const config = ref<AppConfig>(JSON.parse(JSON.stringify(defaultConfig)))
const saving = ref(false)
const testResult = ref<string>('')
const providerBaseUrl = ref('')
const providerApiKey = ref('')
const showApiKey = ref(false)
const loadingModels = ref(false)
const modelOptions = ref<string[]>([])
const translateInputText = ref('')
const translating = ref(false)
const translatedResult = ref('')
const targetLanguages = [
  '中文',
  'English',
  '日本語',
  '한국어',
  'Français',
  'Deutsch',
  'Español',
  'Italiano',
  'Português',
  'Русский',
  'العربية',
  'हिन्दी',
  'ไทย',
  'Tiếng Việt',
  'Bahasa Indonesia',
]
const appVersion = ref('0.1.0')
const latestVersion = ref('')
const hasNewVersion = ref(false)
const checkingUpdate = ref(false)
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
  appVersion.value = await getVersion().catch(() => '0.1.0')
  await refreshPermissions()
  await checkLatestRelease()
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

function canSelectModels() {
  return modelOptions.value.length > 0 && !loadingModels.value
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

function normalizeVersion(version: string) {
  return version.trim().replace(/^v/i, '')
}

function compareVersions(a: string, b: string) {
  const left = normalizeVersion(a).split('.').map(part => Number.parseInt(part, 10) || 0)
  const right = normalizeVersion(b).split('.').map(part => Number.parseInt(part, 10) || 0)
  const length = Math.max(left.length, right.length)

  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0)
    if (diff !== 0) return diff
  }

  return 0
}

async function checkLatestRelease() {
  checkingUpdate.value = true
  try {
    const resp = await fetch(GITHUB_LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!resp.ok) return

    const release = await resp.json() as ReleaseResponse
    if (!release.tag_name || release.draft || release.prerelease) return

    latestVersion.value = normalizeVersion(release.tag_name)
    hasNewVersion.value = compareVersions(latestVersion.value, appVersion.value) > 0
  } catch {
    // Update checks should stay quiet; the version link still opens GitHub.
  } finally {
    checkingUpdate.value = false
  }
}

async function openReleasePage() {
  try {
    await openGithubReleases()
  } catch (e: unknown) {
    testResult.value = `打开 GitHub 失败: ${e instanceof Error ? e.message : '未知错误'}`
  }
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
            <select v-model="config.targetLanguage" class="input-field">
              <option v-for="lang in targetLanguages" :key="lang" :value="lang">{{ lang }}</option>
            </select>
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
          <div>
            <h2 class="section-title">API 连接</h2>
            <p class="section-note">支持 OpenAI API compatible 接口</p>
          </div>
          <button class="btn btn-secondary" :disabled="loadingModels || !providerBaseUrl.trim()" @click="fetchModels">
            {{ loadingModels ? '获取中...' : '获取模型' }}
          </button>
        </div>
        <div class="field-grid">
          <label class="field field-wide">
            <span class="field-label">API 地址</span>
            <input v-model="providerBaseUrl" class="input-field" placeholder="例如 http://127.0.0.1:8888/v1" />
          </label>
          <label class="field field-wide">
            <span class="field-label">API Key</span>
            <span class="secret-field">
              <input
                v-model="providerApiKey"
                :type="showApiKey ? 'text' : 'password'"
                class="input-field secret-input"
                placeholder="按服务要求填写"
              />
              <button
                type="button"
                class="icon-btn secret-toggle"
                :aria-label="showApiKey ? '隐藏 API Key' : '显示 API Key'"
                :title="showApiKey ? '隐藏 API Key' : '显示 API Key'"
                @click="showApiKey = !showApiKey"
              >
                <svg v-if="!showApiKey" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m3 3 18 18" />
                  <path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" />
                  <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.4 18.4 0 0 1-3.2 4.1" />
                  <path d="M6.6 6.6C3.6 8.6 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.2-.8" />
                </svg>
              </button>
            </span>
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
            <select v-model="config.textModel.model" class="input-field" :disabled="!canSelectModels()">
              <option v-if="getAvailableModels().length === 0" disabled value="">请先获取模型</option>
              <option v-for="model in getAvailableModels()" :key="`text-${model}`" :value="model">{{ model }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">截图翻译模型</span>
            <select v-model="config.visionModel.model" class="input-field" :disabled="!canSelectModels()">
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
      <button class="version-link" type="button" @click="openReleasePage">
        <span class="version-dot" :class="{ 'version-dot-active': hasNewVersion }"></span>
        <span>版本 {{ appVersion }}</span>
        <span v-if="hasNewVersion" class="latest-version">最新 {{ latestVersion }}</span>
        <span v-else-if="checkingUpdate" class="latest-version">检查中</span>
      </button>
      <div class="footer-status-wrap">
        <div v-if="testResult" class="footer-status" :class="{
          'footer-success': testResult.includes('成功') || testResult.includes('完成') || testResult.includes('已保存'),
          'footer-fail': testResult.includes('失败'),
        }">
          {{ testResult }}
        </div>
      </div>
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

.section-note {
  margin: 2px 0 0;
  color: #7b8494;
  font-size: 11px;
  line-height: 15px;
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

.input-field:disabled {
  cursor: not-allowed;
  background: #f3f5f8;
  color: #8a93a3;
}

.secret-field {
  position: relative;
  display: block;
}

.secret-input {
  padding-right: 42px;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #687385;
  cursor: pointer;
}

.icon-btn:hover {
  background: #eef2f6;
  color: #202733;
}

.icon-btn svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.secret-toggle {
  position: absolute;
  top: 2px;
  right: 3px;
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
  justify-content: space-between;
  gap: 10px;
  padding: 10px 16px 12px;
  border-top: 1px solid #d8dde6;
  background: rgba(251, 251, 252, 0.96);
}

.version-link {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
  max-width: 230px;
  min-width: 0;
  height: 30px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #7b8494;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  cursor: pointer;
}

.version-link:hover {
  color: #2463ad;
}

.version-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #c7ced8;
}

.version-dot-active {
  background: #22a447;
  box-shadow: 0 0 0 3px rgba(34, 164, 71, 0.14);
}

.latest-version {
  overflow: hidden;
  color: #22a447;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.footer-status-wrap {
  flex: 1 1 auto;
  min-width: 0;
}

.footer-status {
  min-width: 0;
  overflow: hidden;
  color: #596273;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
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
