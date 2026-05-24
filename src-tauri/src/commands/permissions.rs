use std::collections::HashMap;
use std::process::Command;

use tauri::command;

#[cfg(target_os = "macos")]
mod macos_impl {
    use std::os::raw::c_uchar;

    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn AXIsProcessTrusted() -> c_uchar;
        fn CGPreflightScreenCaptureAccess() -> c_uchar;
    }

    pub fn accessibility_granted() -> bool {
        unsafe { AXIsProcessTrusted() != 0 }
    }

    pub fn screen_recording_granted() -> bool {
        unsafe { CGPreflightScreenCaptureAccess() != 0 }
    }
}

fn open_system_settings(url: &str) -> Result<(), String> {
    let output = Command::new("open")
        .arg(url)
        .output()
        .map_err(|e| format!("打开系统设置失败: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            "打开系统设置失败".to_string()
        } else {
            stderr
        })
    }
}

#[command]
pub fn get_permission_status() -> Result<HashMap<String, String>, String> {
    let mut status = HashMap::new();

    #[cfg(target_os = "macos")]
    {
        status.insert(
            "accessibility".to_string(),
            if macos_impl::accessibility_granted() {
                "granted"
            } else {
                "denied"
            }
            .to_string(),
        );
        status.insert(
            "screenRecording".to_string(),
            if macos_impl::screen_recording_granted() {
                "granted"
            } else {
                "denied"
            }
            .to_string(),
        );
        return Ok(status);
    }

    #[cfg(not(target_os = "macos"))]
    {
        status.insert("accessibility".to_string(), "unsupported".to_string());
        status.insert("screenRecording".to_string(), "unsupported".to_string());
        Ok(status)
    }
}

#[command]
pub fn open_accessibility_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return open_system_settings(
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
    );

    #[cfg(not(target_os = "macos"))]
    Err("This command is only available on macOS".to_string())
}

#[command]
pub fn open_screen_recording_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return open_system_settings(
        "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
    );

    #[cfg(not(target_os = "macos"))]
    Err("This command is only available on macOS".to_string())
}
