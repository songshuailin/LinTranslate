# LinTranslate / 灵译

LinTranslate is a lightweight macOS desktop translator for quick selected-text and screenshot translation. It uses OpenAI-compatible API providers, so you can connect it to local models, self-hosted gateways, or cloud services that expose `/v1/chat/completions`.

灵译是一款轻量 macOS 桌面翻译工具，支持划词翻译和截图翻译。它通过 OpenAI-compatible API 接入模型服务，可以连接本地模型、自建网关，或兼容 `/v1/chat/completions` 的云端服务。

## Features / 功能

- Selected-text translation from a global shortcut.
- Screenshot translation from a global shortcut.
- OpenAI-compatible API configuration.
- Separate text and vision model selection.
- Local user configuration; API URL and API Key are not bundled into the app.
- GitHub Releases based version checking.

- 全局快捷键划词翻译。
- 全局快捷键截图翻译。
- 支持 OpenAI-compatible API 配置。
- 支持分别选择文本模型和视觉模型。
- 配置仅保存在用户本地，API URL 和 API Key 不会打包进应用。
- 支持基于 GitHub Releases 的版本检查。

## Shortcuts / 快捷键

- `Command + E`: translate selected text.
- `Command + R`: screenshot translation.

- `Command + E`：翻译选中文本。
- `Command + R`：截图翻译。

## API Setup / API 设置

Use an OpenAI-compatible base URL, for example:

填写 OpenAI-compatible API 地址，例如：

```text
http://127.0.0.1:8888/v1
```

If your provider requires authentication, enter the API Key in Settings. The key is stored only in the current user's local config directory.

如果你的服务需要鉴权，请在设置页填写 API Key。密钥只会保存在当前用户的本地配置目录中。

## Development / 开发

Requirements:

依赖环境：

- Node.js
- pnpm
- Rust and Cargo

Install dependencies:

安装依赖：

```bash
pnpm install
```

Run in development:

开发运行：

```bash
npm run dev
```

Build the app:

构建应用：

```bash
npm run build
```

Build macOS bundles:

构建 macOS 安装包：

```bash
npm run build:mac
```

Future Windows installer build entry, not part of current releases:

未来 Windows 安装包构建入口；当前 release 暂不发布 Windows 版本：

```bash
npm run build:windows
```

Windows packaging is paused until there is a Windows test device. Current GitHub Releases only build and publish the macOS `.dmg`.

在有 Windows 测试设备之前，Windows 打包暂缓。当前 GitHub Releases 只构建和发布 macOS `.dmg`。

### macOS permissions and release signing / macOS 权限与发布签名

macOS Accessibility and Screen Recording permissions are tied to the app identity. For updates to keep existing permissions, release builds must keep the same bundle identifier (`com.localbubble.translator`) and be signed with the same Developer ID Application certificate. Ad-hoc signing (`signingIdentity: "-"`) can make each downloaded build look like a different app to macOS, forcing users to delete and re-add permissions. The current public CI can build ad-hoc `.dmg` files; stable permission-preserving releases require switching CI to Developer ID signing.

macOS 的辅助功能和屏幕录制权限会绑定应用身份。为了让覆盖安装后的新版本继续使用旧授权，发布包必须保持同一个 bundle identifier（`com.localbubble.translator`），并始终使用同一个 Developer ID Application 证书签名。ad-hoc 签名（`signingIdentity: "-"`）可能让每次下载的新包都被 macOS 当成不同应用，从而需要用户删除旧授权后重新添加。当前公开 CI 可以构建 ad-hoc `.dmg`；要稳定保留权限，需要把 CI 切换到 Developer ID 签名。

Configure these GitHub Secrets before publishing a signed macOS release:

发布签名版 macOS release 前，请配置这些 GitHub Secrets：

- `APPLE_CERTIFICATE`: base64 exported Developer ID Application `.p12`
- `APPLE_CERTIFICATE_PASSWORD`: password for that `.p12`
- `APPLE_SIGNING_IDENTITY`: certificate identity, for example `Developer ID Application: Your Name (TEAMID)`
- `APPLE_API_ISSUER`: App Store Connect issuer id
- `APPLE_API_KEY`: App Store Connect key id
- `APPLE_API_KEY_P8`: contents of the App Store Connect `.p8` private key

When Windows packaging resumes, build from a Windows/MSVC environment with Node.js, pnpm, Rust MSVC toolchain, Visual Studio Build Tools, and WebView2 runtime/redistributable support installed. Cross-building Windows installers from macOS is not the supported path for this project.

后续恢复 Windows 打包时，建议在 Windows/MSVC 环境构建，需要 Node.js、pnpm、Rust MSVC 工具链、Visual Studio Build Tools，以及 WebView2 运行时/再发行组件支持。本项目不把 macOS 交叉编译 Windows 安装包作为默认路径。

## Release / 发布

Create and push a version tag to publish a GitHub Release:

推送版本 tag 即可触发 GitHub Release：

```bash
git tag v0.1.0
git push origin v0.1.0
```

## License / 许可证

MIT
