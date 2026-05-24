use std::process::Command;

use tauri::command;

const GITHUB_RELEASES_URL: &str = "https://github.com/songshuailin/LinTranslate/releases";

#[command]
pub fn open_github_releases() -> Result<(), String> {
    open_external_url(GITHUB_RELEASES_URL)
}

fn open_external_url(url: &str) -> Result<(), String> {
    if !url.starts_with("https://github.com/songshuailin/LinTranslate") {
        return Err("不允许打开该链接".to_string());
    }

    #[cfg(target_os = "macos")]
    let status = Command::new("open").arg(url).status();

    #[cfg(target_os = "windows")]
    let status = Command::new("cmd").args(["/C", "start", "", url]).status();

    #[cfg(target_os = "linux")]
    let status = Command::new("xdg-open").arg(url).status();

    status
        .map_err(|e| format!("打开链接失败: {}", e))
        .and_then(|status| {
            if status.success() {
                Ok(())
            } else {
                Err("打开链接失败".to_string())
            }
        })
}
