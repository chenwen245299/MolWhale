//! Where MolWhale keeps everything, and how the app finds it again.
//!
//! # Two files, two jobs
//!
//! The workspace root is chosen by the user, so the app needs a fixed place to
//! remember *which* folder that was: `storage-location.json` in the OS app-data
//! directory holds nothing but that path. Everything else — settings, provider
//! credentials, MCP servers — lives in `.molwhale/config.json` **inside** the
//! chosen root, so a workspace is self-contained and can be moved, synced or
//! backed up as one directory.
//!
//! `get_storage_status` returning `None` is the signal for "first run": the
//! frontend shows the folder picker instead of the main window content.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::fsutil;

pub const CONFIG_DIRECTORY: &str = ".molwhale";
pub const CONFIG_FILENAME: &str = "config.json";
pub const PROJECTS_DIRECTORY: &str = "projects";
const LOCATOR_FILENAME: &str = "storage-location.json";
const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StorageLocator {
    root_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageStatus {
    pub root_path: String,
    pub config_path: String,
    pub projects_path: String,
    /// True when the chosen folder already held a MolWhale workspace, so the UI
    /// can say "reopened your existing workspace" rather than "created".
    pub reused_existing_data: bool,
}

fn locator_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Resolve app data dir: {e}"))?;
    Ok(dir.join(LOCATOR_FILENAME))
}

/// The workspace root, or an error when the user has not picked one yet.
///
/// Every other storage module starts here, which is why it returns `Err` rather
/// than `Option`: reaching a project command before a root exists is a bug in
/// the frontend's ordering, not a state to handle.
pub fn require_root(app: &AppHandle) -> Result<PathBuf, String> {
    let locator = locator_path(app)?;
    let locator: StorageLocator = fsutil::read_json(&locator)
        .ok_or_else(|| "No workspace folder has been chosen yet".to_string())?;
    let root = PathBuf::from(locator.root_path);
    if !root.is_dir() {
        return Err(format!("Workspace folder is missing: {}", root.display()));
    }
    Ok(root)
}

pub fn config_path(root: &Path) -> PathBuf {
    root.join(CONFIG_DIRECTORY).join(CONFIG_FILENAME)
}

pub fn projects_path(root: &Path) -> PathBuf {
    root.join(PROJECTS_DIRECTORY)
}

fn status_for(root: &Path, reused_existing_data: bool) -> StorageStatus {
    StorageStatus {
        root_path: root.to_string_lossy().to_string(),
        config_path: config_path(root).to_string_lossy().to_string(),
        projects_path: projects_path(root).to_string_lossy().to_string(),
        reused_existing_data,
    }
}

#[tauri::command]
pub fn get_storage_status(app: AppHandle) -> Result<Option<StorageStatus>, String> {
    let locator = locator_path(&app)?;
    let Some(locator) = fsutil::read_json::<StorageLocator>(&locator) else {
        return Ok(None);
    };

    let root = PathBuf::from(&locator.root_path);
    if !root.is_dir() {
        // The folder was moved or deleted since last launch. Report "no root" so
        // the user is sent back through the picker instead of hitting a wall of
        // failed reads.
        return Ok(None);
    }

    Ok(Some(status_for(&root, true)))
}

/// Adopt `root_path` as the workspace, creating the scaffolding if it is new.
#[tauri::command]
pub fn set_storage_root(app: AppHandle, root_path: String) -> Result<StorageStatus, String> {
    let root = PathBuf::from(&root_path);
    if !root.is_dir() {
        return Err(format!("Not a folder: {}", root.display()));
    }

    let config = config_path(&root);
    let reused = config.exists();

    std::fs::create_dir_all(root.join(CONFIG_DIRECTORY))
        .map_err(|e| format!("Create {CONFIG_DIRECTORY}: {e}"))?;
    std::fs::create_dir_all(projects_path(&root))
        .map_err(|e| format!("Create {PROJECTS_DIRECTORY}: {e}"))?;

    if !reused {
        crate::config::write_config(&root, &crate::config::AppConfig::new(SCHEMA_VERSION))?;
    }

    let locator = locator_path(&app)?;
    fsutil::write_json(&locator, &StorageLocator { root_path })?;

    Ok(status_for(&root, reused))
}
