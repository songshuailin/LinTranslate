# Local Bubble Translator — 开发文档

本地大模型优先的 macOS 划词 / 截图气泡翻译器。第一版只做核心体验：选中文字 → 快捷键 → 流式气泡翻译；截图 → 视觉模型 → 流式气泡翻译。

---

## 0. 项目目标

核心能力：

1. 用户选中任意 App 中的一段文字。
2. 按快捷键触发翻译。
3. 工具读取当前选中文本。
4. 调用 OpenAI-compatible API，支持本地大模型（oMLX / LM Studio / Ollama 代理 / 自建 OpenAI 兼容服务）。
5. 使用流式输出，在屏幕气泡窗口中实时显示翻译结果。
6. 点击空白处或再次按快捷键关闭气泡。
7. 气泡支持拖动、复制和关闭，不做图钉固定。
8. 当文字不能被选中时，用户可使用截图翻译。
9. 截图翻译不使用 OCR，直接将截图图片发送给支持视觉能力的 OpenAI-compatible 多模态模型，让模型识别图片中的文字并翻译。
10. 第一版只做 macOS，后续再考虑 Windows/Linux。

项目定位："本地大模型优先的 macOS 划词 / 截图气泡翻译器"。不是普通 OCR 翻译器，不做大而全功能，第一版只追求核心体验稳定可用。

---

## 1. 技术栈要求

### 桌面框架

- Tauri v2
- Vue 3
- TypeScript
- UnoCSS
- Pinia（可选）
- Rust 负责 Tauri 原生命令
- 必要时通过 Rust 调 macOS 原生 API

不使用 Electron。第一版不要使用 Electron，原因：常驻工具不适合过重运行时；Tauri 更轻量；系统能力本来就要走原生层，Electron 不能绕开 macOS 权限问题。

### macOS 原生能力（需要实现）

- 全局快捷键
- 剪贴板读取与恢复
- 模拟 Command + C 获取选中文本
- 截图区域选择
- 悬浮窗口 / 气泡窗口
- 多窗口管理
- 菜单栏常驻
- 权限检测与引导

第一版优先用可稳定落地的方式，不要追求完美自动化。

---

## 2. 第一版功能范围

### 必须实现

#### A. 菜单栏常驻

App 启动后常驻 macOS 菜单栏。菜单项：打开设置、翻译选中文本、截图翻译、退出。

#### B. 选中文本快捷翻译

默认快捷键：`Command + E`

行为：用户在任意 App 中选中文字，按 Command + E。App 获取选中文本。如果文本为空，显示轻提示"未检测到选中文本"。如果文本有效，创建翻译气泡，调用文本翻译模型，流式显示翻译结果。

#### C. 截图翻译

默认快捷键：`Command + R`

行为：用户按快捷键，屏幕出现截图框选遮罩。用户拖拽选择区域，App 截取图片，图片转 base64，调用视觉模型，让模型识别图片中的文字并翻译。在截图区域附近或鼠标附近显示气泡。

注意：第一版不做 OCR，截图翻译直接走多模态模型。

#### D. 翻译气泡

气泡要求：无边框、透明背景或圆角卡片、置顶显示、支持流式追加文本、支持复制翻译结果、支持拖动、支持关闭。点击气泡外部、按 Esc 或再次按 `Command + E` 关闭当前气泡。

气泡内容：状态（翻译中/完成/错误）、原文折叠展示（可选）、翻译结果、复制按钮、关闭按钮。

#### E. 设置页

设置项：目标语言、文本翻译模型配置、截图翻译模型配置、快捷键设置（第一版可先固定，不做编辑）、API 测试按钮、权限状态检测。

### 暂不实现的功能（第一版不要做）

- OCR
- 自动划词后弹出小图标
- 鼠标松开自动检测选区
- 历史记录
- 收藏夹
- 发音
- 词典
- 多平台适配
- 多语言复杂自动检测
- 自动更新
- 云同步
- 插件系统
- 登录系统

第一版目标：选中文字 → 快捷键 → 本地模型流式气泡翻译；截图 → 多模态模型直接识图翻译。

---

## 3. 核心用户流程

### 划词翻译流程

```
用户选中文字
    ↓
按 Command + E
    ↓
Tauri 后端执行 get_selected_text()
    ↓
优先尝试 Accessibility API
    ↓
失败则模拟 Command + C
    ↓
读取剪贴板文本
    ↓
恢复原剪贴板
    ↓
返回文本给前端
    ↓
Tauri 创建独立 popup 气泡窗口
    ↓
调用 translateText()
    ↓
接收流式响应
    ↓
实时追加到气泡
    ↓
完成
```

### 截图翻译流程

```
用户按 Command + R
    ↓
显示截图遮罩
    ↓
用户框选区域
    ↓
原生层截图
    ↓
图片转 base64
    ↓
前端创建气泡窗口
    ↓
调用 translateImage()
    ↓
多模态模型识别并翻译
    ↓
流式显示结果
    ↓
完成
```

### 气泡关闭流程

- 点击外部、按 Esc、点击关闭按钮或再次按 `Command + E` → 关闭当前气泡窗口。
- 气泡顶部栏可拖动，复制和关闭按钮不会触发拖动。
- `Command + Q` 第一次显示提示，2 秒内再次按才退出；托盘菜单“退出”为明确退出。

---

## 4. 项目目录结构

```
local-bubble-translator/
├─ package.json
├─ vite.config.ts
├─ uno.config.ts
├─ tsconfig.json
├─ index.html
│
├─ src/
│  ├─ main.ts
│  ├─ App.vue
│  │
│  ├─ windows/
│  │  ├─ popup/
│  │  │  ├─ PopupWindow.vue
│  │  │  ├─ popup-store.ts
│  │  │  └─ popup-types.ts
│  │  ├─ settings/
│  │  │  ├─ SettingsWindow.vue
│  │  │  └─ settings-store.ts
│  │  └─ screenshot/
│  │     ├─ ScreenshotOverlay.vue
│  │     └─ screenshot-store.ts
│  │
│  ├─ services/
│  │  ├─ translator/
│  │  │  ├─ openai-compatible.ts
│  │  │  ├─ text-translator.ts
│  │  │  ├─ image-translator.ts
│  │  │  └─ translator-types.ts
│  │  ├─ tauri/
│  │  │  ├─ commands.ts
│  │  │  └─ events.ts
│  │  └─ config/
│  │     ├─ app-config.ts
│  │     └─ config-storage.ts
│  │
│  ├─ composables/
│  │  ├─ useTranslationStream.ts
│  │  ├─ usePopupWindow.ts
│  │  └─ useHotkeys.ts
│  │
│  ├─ components/
│  │  ├─ BaseButton.vue
│  │  ├─ BaseInput.vue
│  │  ├─ BaseSelect.vue
│  │  └─ StreamText.vue
│  │
│  └─ styles/
│     └─ main.css
│
├─ src-tauri/
│  ├─ Cargo.toml
│  ├─ tauri.conf.json
│  │
│  └─ src/
│     ├─ main.rs
│  ├─ commands/
│  │  ├─ mod.rs
│  │  ├─ clipboard.rs
│  │  ├─ selected_text.rs
│  │  ├─ screenshot.rs
│  │  ├─ window.rs
│  │  └─ permissions.rs
│  ├─ macos/
│  │  ├─ mod.rs
│  │  ├─ accessibility.rs
│  │  ├─ clipboard.rs
│  │  ├─ keyboard.rs
│  │  ├─ screen_capture.rs
│  │  └─ permission.rs
│  └─ app_config.rs
```

---

## 5. 核心类型设计

### 应用配置

```typescript
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
```

默认配置：

- targetLanguage: '中文'
- textModel / visionModel: baseUrl='', apiKey='', model='', temperature=0.2, stream=true
- hotkeys: translateSelection='Command+E', translateScreenshot='Command+R'
- popup: defaultWidth=420, defaultMaxHeight=520, closeOnBlur=true

### 翻译请求类型

```typescript
export type TranslateTextInput = { text: string; targetLanguage: string }
export type TranslateImageInput = { imageBase64: string; targetLanguage: string }
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
}
```

---

## 6. OpenAI-compatible API 设计

### 文本翻译接口（src/services/translator/text-translator.ts）

```typescript
export async function* translateTextStream(
  config: OpenAICompatibleModelConfig,
  input: TranslateTextInput,
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
  if (config.apiKey.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`Translation API error: ${response.status} ${response.statusText}`)
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
      } catch { /* 忽略不完整 SSE 片段 */ }
    }
  }
}
```

### 图片翻译接口（src/services/translator/image-translator.ts）

与文本翻译类似，但 messages 中 content 为数组格式：
- type: 'text' — "请识别图片中的可见文字，并翻译成{targetLanguage}。只输出翻译结果。"
- type: 'image_url' — 图片 base64 data URL

---

## 7. Prompt 设计

### 文本翻译 System Prompt

```
你是一个专业翻译引擎。将用户提供的文本翻译成{targetLanguage}。
规则：只输出翻译结果，不要解释/注释/前缀/总结/扩写。保持原文含义准确，尽量保留换行和段落结构。代码、命令、路径、变量名、API 名称等专有内容不要错误翻译，混有英文技术术语时必要时保留原文。
```

### 图片翻译 System Prompt

```
你是一个截图文字翻译引擎。识别图片中的可见文字，并翻译成{targetLanguage}。
规则：只输出翻译结果，不要描述图片/解释画面/前缀。如果图片中没有可读文字，只输出：未识别到可翻译文字。尽量按阅读顺序输出，保留换行和段落结构。对明显的 UI 按钮、菜单、错误提示，直接翻译其文字含义。
```

---

## 8. 选中文本获取策略

第一版主方案：模拟 Command + C（成功率最高）。

流程：
1. 保存当前剪贴板内容
2. 模拟 Command + C
3. 等待 80-150ms
4. 读取剪贴板文本
5. 恢复原剪贴板
6. 返回文本

第二优先：Accessibility API（预留接口 `get_selected_text_by_accessibility()`，第一版可暂不完整实现）。

最终策略：`get_selected_text()` → 尝试 Accessibility → 成功则返回 → 失败则 fallback 到 Command + C。

---

## 9. Tauri Commands 设计

前端封装（src/services/tauri/commands.ts）：
- `getSelectedText(): Promise<string>` → 调用 Rust `get_selected_text`
- `startScreenshotSelection(): Promise<string>` → 返回 imageBase64
- `getPermissionStatus(): Promise<PermissionStatus>`
- `openAccessibilitySettings()` / `openScreenRecordingSettings()`

Rust commands（src-tauri/src/commands/）：
- `#[tauri::command] async fn get_selected_text() -> Result<String, String>`
- `#[tauri::command] async fn start_screenshot_selection() -> Result<String, String>`
- `#[tauri::command] async fn get_permission_status() -> Result<PermissionStatus, String>`
- `#[tauri::command] async fn open_accessibility_settings() -> Result<(), String>`
- `#[tauri::command] async fn open_screen_recording_settings() -> Result<(), String>`

---

## 10. 快捷键设计

- `Command + E`：翻译选中文本；当前气泡存在时关闭气泡
- `Command + R`：截图翻译
- `Esc`：关闭当前气泡

不使用 Command + S（与大量 App 冲突）。

---

## 11. 气泡窗口设计

### 窗口类型（至少两个）
- settings：设置窗口
- popup：翻译气泡窗口
- screenshot-overlay：全屏透明遮罩窗口（截图用）

### PopupStore 状态管理

```typescript
export const usePopupStore = defineStore('popup', {
  state: () => ({ popups: [] as TranslationPopup[], activePopupId: null as string | null }),
  actions: {
    createPopup(payload: Partial<TranslationPopup>),
    appendDelta(id: string, delta: string),
    setStatus(id: string, status: TranslationStatus),
    setError(id: string, message: string),
    closePopup(id: string),
  },
})
```

### UI 样式（UnoCSS）

简洁、圆角、阴影、最大宽度 420px、最大高度 520px。

```html
<div class="w-420px max-h-520px rounded-2xl bg-white/95 shadow-xl border border-gray-200 overflow-hidden">
  <div class="flex items-center justify-between px-3 py-2 border-b border-gray-100">
    <div class="text-sm font-medium">翻译</div>
    <div class="flex gap-2"><button>复制</button><button>关闭</button></div>
  </div>
  <div class="p-3 overflow-auto text-sm leading-6">{{ translatedText }}</div>
</div>
```

---

## 12. 设置页设计

- 目标语言：中文/英文/日文/韩文/自定义
- 文本翻译模型：baseUrl / apiKey / model / temperature / 测试连接
- 截图翻译模型：同上
- 权限状态显示 + 打开系统设置按钮

配置保存路径：`~/Library/Application Support/LocalBubbleTranslator/config.json`
第一版用 Tauri store plugin 或自己保存到 JSON，不引入数据库。

---

## 13. 权限设计

macOS 需要关注：
- **Accessibility 权限**：用于模拟按键、读取选中文本
- **Screen Recording 权限**：用于截图翻译
- **Input Monitoring 权限**：全局快捷键可能涉及

设置页必须显示权限状态。如果权限不足，翻译选中文本时提示需要辅助功能权限；截图翻译时提示需要屏幕录制权限。提供打开系统设置按钮，分别跳转到"隐私与安全性 > 辅助功能"和"隐私与安全性 > 屏幕录制"。

---

## 14. 错误处理规范

必须处理的错误：
1. **没有选中文本** → "未检测到选中文本"
2. **没有权限** → "缺少辅助功能/屏幕录制权限，请在系统设置中授权"
3. **API 无法连接** → "翻译模型连接失败，请检查 API 地址、模型名称和服务状态"
4. **模型不支持图片** → "当前模型可能不支持图片输入，请在设置中配置支持视觉能力的模型"
5. **流式响应异常** → 显示已收到的部分翻译，底部提示"翻译中断"

---

## 15. 开发步骤（按阶段推进，不跳步）

### 阶段 1：项目初始化
- Tauri v2 + Vue3 + TypeScript + UnoCSS 基础项目
- settings 窗口、popup 窗口
- 验收：`pnpm tauri dev` 可以启动，菜单栏或主窗口可打开

### 阶段 2：配置系统
- AppConfig 类型、defaultConfig、loadConfig()、saveConfig()
- 设置页可修改配置，重启后保留

### 阶段 3：OpenAI-compatible 文本翻译
- translateTextStream()、SSE 解析、"测试文本翻译"按钮
- 验收：本地模型可正常流式返回

### 阶段 4：气泡 UI
- PopupWindow.vue、PopupStore、createPopup/appendDelta/streaming
- 复制按钮、关闭按钮、顶部栏拖动

### 阶段 5：获取选中文本
- Rust get_selected_text（Command + C 方案）
- 前端调用、注册 Command + E 快捷键

### 阶段 6：窗口定位和点击外部关闭
- 气泡出现在鼠标位置附近或屏幕中央偏上
- 气泡失焦/点击外部后关闭，Esc 可关闭

### 阶段 7：截图翻译
- 截图遮罩窗口、框选区域、截取图片转 base64
- translateImageStream()、注册 Command + R

### 阶段 8：权限检测和提示
- 检测辅助功能/屏幕录制权限，设置页显示状态

### 阶段 9：打包
- 配置 App 名称、图标、bundle identifier，生成 dmg

---

## 16. 代码风格要求

- TypeScript 必须尽量有明确类型，不要写 any（除非确实无法避免）
- 每个 service 单独拆文件
- API 请求不写进 Vue 组件，组件只负责 UI 和调用 service
- Rust command 只负责系统能力，不负责翻译业务
- 错误必须返回明确 message，不要吞错误
- 不要一次性实现所有功能，按阶段推进。每完成一个阶段保证项目可运行

---

## 17. 第一版不追求的东西（不要浪费时间）

- 自动选区坐标识别
- 划词后自动弹小图标
- OCR
- 复杂历史记录
- 多平台
- 账户系统、云同步、词典、发音
- 漂亮动画、复杂主题系统

第一版只要做到：选中 → 快捷键 → 流式气泡翻译；截图 → 视觉模型 → 流式气泡翻译。

---

## 18. 关键实现原则

1. **先稳定，再优雅**：Command + C 兜底方案优先
2. **截图翻译不做 OCR**：直接交给视觉模型处理
3. **文本模型和视觉模型分开配置**：设置页保留两个模型配置
4. **不要占用 Command + S**：使用 Command + E / Command + R
5. **所有翻译都流式输出**：快速反馈

---

## 19. 最小验收标准（第一版必须满足）

1. App 能在 macOS 启动
2. App 有设置页，可配置 OpenAI-compatible API、文本模型、视觉模型、目标语言
3. 在浏览器选中英文后，按 Command + E 能弹出气泡翻译成中文（VS Code 同理）
4. 气泡支持流式输出、复制、关闭、拖动
5. 按 Command + R 能截图，发送给视觉模型翻译
6. API 错误时有明确提示，权限不足时有明确提示

---

## 20. 模型配置

- 默认 API 地址、API Key 和模型名均留空。
- 用户在设置页填写自己的 OpenAI-compatible API 地址，并通过“获取模型”选择文本模型和视觉模型。

注意：模型名称必须允许用户在设置页修改，不要写死。

---

## 21. 后续版本规划

- **v0.1**：划词快捷键翻译、气泡流式展示、设置页
- **v0.2**：截图翻译、视觉模型支持、权限引导
- **v0.3**：权限检测、打包、体验优化
- **v0.4**：历史记录、多个 Provider、快捷键自定义
- **v0.5**：可选 OCR 极速模式、自动划词图标、Windows 适配评估

---

## 22. 请从这里开始执行（当前第一任务）

初始化 Tauri v2 + Vue3 + TypeScript + UnoCSS 项目。创建 settings 窗口和 popup 窗口。实现基础 AppConfig 类型和默认配置。确保 `pnpm tauri dev` 可以启动。

完成后汇报：
1. 创建了哪些文件
2. 当前能运行什么
3. 下一步准备做什么
4. 是否有阻塞问题

---

*文档版本：v0.1 | 最后更新：2024-05-21*
