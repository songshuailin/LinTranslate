use tauri::{command, Manager};

#[command]
pub fn close_popup_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("popup") {
        win.destroy()
            .map_err(|e| format!("关闭翻译气泡窗口失败: {}", e))?;
    }

    Ok(())
}
