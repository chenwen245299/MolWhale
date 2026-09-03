//! AI providers (OpenRouter first) and their credentials.
//!
//! # Two structs, on purpose
//!
//! `Provider` is what is stored — it holds the API key. `ProviderInfo` is what
//! the provider *list* returns, and it carries `has_key: bool` instead of the
//! key itself. So the settings UI, which renders every provider, never has the
//! secrets in its state; only the one call that is about to build an HTTP
//! client asks for one.
//!
//! # The deliberate exception: `get_provider_key`
//!
//! MolWhale runs its agent loop in the frontend with the OpenAI JS SDK, which
//! means the key must reach the webview to sign a request. `get_provider_key`
//! is that door, kept as a single named command rather than widening
//! `ProviderInfo`, so it is greppable and so moving the loop into Rust later
//! means deleting one command and one call site (`chat/chatRuntime.ts`).

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::config;
use crate::fsutil;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Model {
    pub id: String,
    #[serde(default)]
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub id: String,
    pub name: String,
    /// `openai_compatible` today. Anthropic's native wire format would be a
    /// second kind; OpenRouter, OpenAI, DeepSeek, vLLM etc. are all the first.
    #[serde(default = "default_kind")]
    pub kind: String,
    pub base_url: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default = "bool_true")]
    pub enabled: bool,
    #[serde(default)]
    pub models: Vec<Model>,
    #[serde(default)]
    pub default_model: Option<String>,
    #[serde(default)]
    pub created_at: String,
}

fn default_kind() -> String {
    "openai_compatible".to_string()
}

fn bool_true() -> bool {
    true
}

impl Provider {
    /// The one provider a fresh workspace starts with. Key is empty — the user
    /// pastes theirs — but the base URL and name are filled in so there is
    /// nothing to look up.
    pub fn openrouter_template() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: "OpenRouter".to_string(),
            kind: default_kind(),
            base_url: "https://openrouter.ai/api/v1".to_string(),
            api_key: String::new(),
            enabled: true,
            models: Vec::new(),
            default_model: None,
            created_at: fsutil::now_rfc3339(),
        }
    }
}

/// Returned to the frontend — never includes the raw API key.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub base_url: String,
    pub enabled: bool,
    pub has_key: bool,
    pub models: Vec<Model>,
    pub default_model: Option<String>,
    pub created_at: String,
}

impl From<&Provider> for ProviderInfo {
    fn from(p: &Provider) -> Self {
        Self {
            id: p.id.clone(),
            name: p.name.clone(),
            kind: p.kind.clone(),
            base_url: p.base_url.clone(),
            enabled: p.enabled,
            has_key: !p.api_key.trim().is_empty(),
            models: p.models.clone(),
            default_model: p.default_model.clone(),
            created_at: p.created_at.clone(),
        }
    }
}

/// Fields the settings form sends. `id: None` means "create".
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInput {
    pub id: Option<String>,
    pub name: String,
    #[serde(default = "default_kind")]
    pub kind: String,
    pub base_url: String,
    /// `None` leaves the stored key alone, so editing a provider's name does
    /// not silently wipe its credentials.
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default = "bool_true")]
    pub enabled: bool,
}

#[tauri::command]
pub fn list_providers(app: AppHandle) -> Result<Vec<ProviderInfo>, String> {
    Ok(config::load(&app)?
        .providers
        .iter()
        .map(ProviderInfo::from)
        .collect())
}

#[tauri::command]
pub fn upsert_provider(app: AppHandle, input: ProviderInput) -> Result<ProviderInfo, String> {
    config::update(&app, |cfg| {
        let name = input.name.trim();
        if name.is_empty() {
            return Err("Provider name cannot be empty".to_string());
        }
        let base_url = input.base_url.trim().trim_end_matches('/');
        if base_url.is_empty() {
            return Err("Base URL cannot be empty".to_string());
        }

        match input.id {
            Some(id) => {
                let provider = cfg
                    .providers
                    .iter_mut()
                    .find(|p| p.id == id)
                    .ok_or_else(|| format!("No such provider: {id}"))?;
                provider.name = name.to_string();
                provider.kind = input.kind;
                provider.base_url = base_url.to_string();
                provider.enabled = input.enabled;
                if let Some(key) = input.api_key {
                    provider.api_key = key.trim().to_string();
                }
                Ok(ProviderInfo::from(&*provider))
            }
            None => {
                let provider = Provider {
                    id: uuid::Uuid::new_v4().to_string(),
                    name: name.to_string(),
                    kind: input.kind,
                    base_url: base_url.to_string(),
                    api_key: input.api_key.unwrap_or_default().trim().to_string(),
                    enabled: input.enabled,
                    models: Vec::new(),
                    default_model: None,
                    created_at: fsutil::now_rfc3339(),
                };
                let info = ProviderInfo::from(&provider);
                cfg.providers.push(provider);
                Ok(info)
            }
        }
    })
}

#[tauri::command]
pub fn delete_provider(app: AppHandle, id: String) -> Result<(), String> {
    config::update(&app, |cfg| {
        cfg.providers.retain(|p| p.id != id);
        Ok(())
    })
}

#[tauri::command]
pub fn set_provider_key(
    app: AppHandle,
    id: String,
    api_key: String,
) -> Result<ProviderInfo, String> {
    config::update(&app, |cfg| {
        let provider = cfg
            .providers
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or_else(|| format!("No such provider: {id}"))?;
        provider.api_key = api_key.trim().to_string();
        Ok(ProviderInfo::from(&*provider))
    })
}

/// Hand the raw key to the frontend so it can construct an OpenAI client.
///
/// See the module header: this is the one intentional hole in "keys stay in
/// Rust", and it exists because the agent loop lives in JS.
#[tauri::command]
pub fn get_provider_key(app: AppHandle, id: String) -> Result<String, String> {
    let config = config::load(&app)?;
    let provider = config
        .providers
        .iter()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("No such provider: {id}"))?;
    if provider.api_key.trim().is_empty() {
        return Err(format!("{} has no API key configured", provider.name));
    }
    Ok(provider.api_key.clone())
}

#[tauri::command]
pub fn set_provider_models(
    app: AppHandle,
    id: String,
    models: Vec<Model>,
) -> Result<ProviderInfo, String> {
    config::update(&app, |cfg| {
        let provider = cfg
            .providers
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or_else(|| format!("No such provider: {id}"))?;
        provider.models = models;
        Ok(ProviderInfo::from(&*provider))
    })
}

#[tauri::command]
pub fn set_provider_default_model(
    app: AppHandle,
    id: String,
    model: Option<String>,
) -> Result<ProviderInfo, String> {
    config::update(&app, |cfg| {
        let provider = cfg
            .providers
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or_else(|| format!("No such provider: {id}"))?;
        provider.default_model = model;
        Ok(ProviderInfo::from(&*provider))
    })
}
