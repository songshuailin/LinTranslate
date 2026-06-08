use std::fs;
use std::path::PathBuf;

use serde_json::Value;
use tauri::command;

fn config_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法读取 HOME 目录".to_string())?;
        return Ok(PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("LocalBubbleTranslator"));
    }

    #[cfg(not(target_os = "macos"))]
    {
        let home = std::env::var("HOME").map_err(|_| "无法读取 HOME 目录".to_string())?;
        Ok(PathBuf::from(home)
            .join(".config")
            .join("LocalBubbleTranslator"))
    }
}

fn config_path() -> Result<PathBuf, String> {
    Ok(config_dir()?.join("config.json"))
}

fn restrict_config_permissions(path: &PathBuf) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        let permissions = fs::Permissions::from_mode(0o600);
        fs::set_permissions(path, permissions)
            .map_err(|e| format!("设置配置文件权限失败: {}", e))?;
    }

    #[cfg(not(unix))]
    {
        let _ = path;
    }

    Ok(())
}

fn require_string(value: &Value, path: &[&str], label: &str) -> Result<(), String> {
    let mut current = value;
    for key in path {
        current = current
            .get(*key)
            .ok_or_else(|| format!("{}不能为空", label))?;
    }

    match current.as_str() {
        Some(text) if !text.trim().is_empty() => Ok(()),
        _ => Err(format!("{}不能为空", label)),
    }
}

fn validate_model_config(value: &Value, key: &str, label: &str) -> Result<(), String> {
    let model_config = value.get(key).ok_or_else(|| format!("{}配置缺失", label))?;

    // Skip validation if the model is not configured at all (baseUrl is empty).
    let base_url = model_config
        .get("baseUrl")
        .and_then(Value::as_str)
        .unwrap_or("");
    if base_url.trim().is_empty() {
        return Ok(());
    }

    require_string(value, &[key, "model"], &format!("{}模型", label))?;

    let temperature = model_config
        .get("temperature")
        .and_then(Value::as_f64)
        .ok_or_else(|| format!("{} temperature 必须是数字", label))?;
    if !(0.0..=2.0).contains(&temperature) {
        return Err(format!("{} temperature 必须在 0 到 2 之间", label));
    }

    Ok(())
}

fn validate_config(value: &Value) -> Result<(), String> {
    require_string(value, &["targetLanguage"], "目标语言")?;
    validate_model_config(value, "textModel", "文本翻译")?;
    validate_model_config(value, "visionModel", "截图翻译")?;
    Ok(())
}

#[command]
pub fn load_app_config() -> Result<Option<Value>, String> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(&path).map_err(|e| format!("读取配置失败: {}", e))?;
    let value = serde_json::from_str::<Value>(&text).map_err(|e| format!("配置文件损坏: {}", e))?;
    validate_config(&value)?;

    Ok(Some(value))
}

#[command]
pub fn save_app_config(config: Value) -> Result<(), String> {
    validate_config(&config)?;

    let dir = config_dir()?;
    fs::create_dir_all(&dir).map_err(|e| format!("创建配置目录失败: {}", e))?;

    let path = dir.join("config.json");
    let text =
        serde_json::to_string_pretty(&config).map_err(|e| format!("序列化配置失败: {}", e))?;
    fs::write(&path, text).map_err(|e| format!("保存配置失败: {}", e))?;
    restrict_config_permissions(&path)
}
