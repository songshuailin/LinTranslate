use tauri::command;

#[cfg(target_os = "macos")]
mod macos_impl {
    use std::os::raw::c_void;
    use std::process::{Command, Stdio};
    use std::thread;
    use std::time::Duration;

    type CGEventRef = *mut c_void;
    type CGEventSourceRef = *mut c_void;
    type CGKeyCode = u16;
    type CGEventFlags = u64;
    type CGEventTapLocation = u32;

    const KEY_C: CGKeyCode = 8;
    const CG_EVENT_FLAG_MASK_COMMAND: CGEventFlags = 1 << 20;
    const CG_HID_EVENT_TAP: CGEventTapLocation = 0;

    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn AXIsProcessTrusted() -> u8;
        fn CGEventCreateKeyboardEvent(
            source: CGEventSourceRef,
            virtual_key: CGKeyCode,
            key_down: bool,
        ) -> CGEventRef;
        fn CGEventSetFlags(event: CGEventRef, flags: CGEventFlags);
        fn CGEventPost(tap: CGEventTapLocation, event: CGEventRef);
        fn CFRelease(cf: *const c_void);
    }

    fn get_clipboard() -> Result<String, String> {
        let output = Command::new("pbpaste")
            .output()
            .map_err(|e| format!("读取剪贴板失败: {}", e))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            Ok(String::new())
        }
    }

    fn set_clipboard(text: &str) -> Result<(), String> {
        Command::new("pbcopy")
            .stdin(Stdio::piped())
            .spawn()
            .and_then(|mut child| {
                use std::io::Write;

                if let Some(mut stdin) = child.stdin.take() {
                    stdin.write_all(text.as_bytes())?;
                }

                child.wait()?;
                Ok(())
            })
            .map_err(|e| format!("恢复剪贴板失败: {}", e))
    }

    fn simulate_copy() -> Result<(), String> {
        if unsafe { AXIsProcessTrusted() == 0 } {
            return Err("缺少辅助功能权限，请在系统设置中授权 /Applications/灵译.app".to_string());
        }

        post_key_event(KEY_C, true)?;
        post_key_event(KEY_C, false)?;
        thread::sleep(Duration::from_millis(150));
        Ok(())
    }

    fn post_key_event(key: CGKeyCode, key_down: bool) -> Result<(), String> {
        let event = unsafe { CGEventCreateKeyboardEvent(std::ptr::null_mut(), key, key_down) };
        if event.is_null() {
            return Err("模拟 Command+C 失败：无法创建键盘事件".to_string());
        }

        unsafe {
            CGEventSetFlags(event, CG_EVENT_FLAG_MASK_COMMAND);
            CGEventPost(CG_HID_EVENT_TAP, event);
            CFRelease(event as *const c_void);
        }
        Ok(())
    }

    pub fn get_selected_text() -> Result<String, String> {
        let original_clipboard = get_clipboard()?;

        if let Err(err) = simulate_copy() {
            let _ = set_clipboard(&original_clipboard);
            return Err(err);
        }

        let copied_text = get_clipboard()?;
        let _ = set_clipboard(&original_clipboard);

        let selected_text = copied_text.trim().to_string();
        if selected_text.is_empty() {
            Err("未检测到选中文本".to_string())
        } else {
            Ok(selected_text)
        }
    }
}

#[command]
pub fn get_selected_text() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    return macos_impl::get_selected_text();

    #[cfg(not(target_os = "macos"))]
    Err("This command is only available on macOS".to_string())
}
