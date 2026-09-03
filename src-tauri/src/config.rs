//! The workspace config file: `<root>/.molwhale/config.json`.
//!
//! One file holds app settings, AI providers (including their API keys) and MCP
//! server definitions. Two properties matter and are enforced here rather than
//! at each call site:
//!
//! * **Atomic writes** — a crash mid-save must never leave a config that fails
//!   to parse, because that file is also where the API keys live.
//! * **Unknown keys survive** — `#[serde(flatten)] extra` round-trips any field
//!   this version does not know about, so opening a workspace in an older build
//!   does not silently delete a newer build's settings.

use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::fsutil;
use crate::mcp::McpServerConfig;
use crate::providers::Provider;
use crate::storage;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// UI language tag. `zh-CN` is the default; the frontend owns the list.
    #[serde(default = "default_locale")]
    pub locale: String,
    /// Ceiling on tool-call rounds in one answer. A model that has not finished
    /// after this many rounds is going in circles, and each round is billed.
    #[serde(default = "default_max_rounds")]
    pub max_tool_rounds: u32,
    #[serde(default)]
    pub system_prompt: String,
}

fn default_locale() -> String {
    "zh-CN".to_string()
}

fn default_max_rounds() -> u32 {
    8
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            locale: default_locale(),
            max_tool_rounds: default_max_rounds(),
            system_prompt: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(default)]
    pub schema_version: u32,
    #[serde(default)]
    pub app: String,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub settings: Settings,
    #[serde(default)]
    pub providers: Vec<Provider>,
    #[serde(default)]
    pub mcp_servers: Vec<McpServerConfig>,
    /// Anything this build does not model, preserved verbatim across writes.
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            schema_version: 1,
            app: "MolWhale".to_string(),
            created_at: fsutil::now_rfc3339(),
            settings: Settings::default(),
            providers: Vec::new(),
            mcp_servers: Vec::new(),
            extra: Map::new(),
        }
    }
}

impl AppConfig {
    /// A brand-new workspace, pre-seeded with an OpenRouter provider so the
    /// user only has to paste a key rather than also work out the base URL.
    pub fn new(schema_version: u32) -> Self {
        Self {
            schema_version,
            providers: vec![Provider::openrouter_template()],
            ..Default::default()
        }
    }
}

pub fn read_config(root: &Path) -> AppConfig {
    fsutil::read_json(&storage::config_path(root)).unwrap_or_default()
}

pub fn write_config(root: &Path, config: &AppConfig) -> Result<(), String> {
    fsutil::write_json(&storage::config_path(root), config)
}

/// Read-modify-write the config under one call, returning whatever `f` returns.
///
/// Every mutating provider/MCP command goes through this so the read and the
/// write can't drift apart.
pub fn update<T>(
    app: &tauri::AppHandle,
    f: impl FnOnce(&mut AppConfig) -> Result<T, String>,
) -> Result<T, String> {
    let root = storage::require_root(app)?;
    let mut config = read_config(&root);
    let out = f(&mut config)?;
    write_config(&root, &config)?;
    Ok(out)
}

/// Read the config for the current workspace.
pub fn load(app: &tauri::AppHandle) -> Result<AppConfig, String> {
    let root = storage::require_root(app)?;
    Ok(read_config(&root))
}

#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    Ok(load(&app)?.settings)
}

#[tauri::command]
pub fn set_settings(app: tauri::AppHandle, settings: Settings) -> Result<Settings, String> {
    update(&app, |config| {
        config.settings = settings;
        Ok(config.settings.clone())
    })
}
