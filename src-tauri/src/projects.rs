//! Projects: one directory each, directly under `<root>/projects/`.
//!
//! The directory name *is* the project id. That keeps the on-disk layout
//! legible — a user browsing the workspace in Finder sees the names they typed,
//! not UUIDs — at the cost of a rename being a directory move. `project.json`
//! carries the display name, which is the source of truth when it disagrees
//! with the directory name (e.g. after the user renamed the folder by hand).

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::fsutil;
use crate::storage;

pub const METADATA_FILENAME: &str = "project.json";
pub const CONVERSATIONS_DIRECTORY: &str = "conversations";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMeta {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    /// Directory name under `projects/`.
    pub id: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
    pub path: String,
    pub conversation_count: usize,
}

pub fn project_dir(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    let root = storage::require_root(app)?;
    let id = fsutil::safe_segment(id)?;
    let dir = storage::projects_path(&root).join(id);
    if !dir.is_dir() {
        return Err(format!("No such project: {id}"));
    }
    Ok(dir)
}

pub fn conversations_dir(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    Ok(project_dir(app, project_id)?.join(CONVERSATIONS_DIRECTORY))
}

fn count_conversations(dir: &Path) -> usize {
    let convs = dir.join(CONVERSATIONS_DIRECTORY);
    let Ok(entries) = std::fs::read_dir(&convs) else {
        return 0;
    };
    entries
        .flatten()
        .filter(|e| {
            e.path()
                .join(crate::conversations::METADATA_FILENAME)
                .exists()
        })
        .count()
}

fn read_project(dir: &Path) -> Option<Project> {
    let id = dir.file_name()?.to_string_lossy().to_string();
    let meta: ProjectMeta = fsutil::read_json(&dir.join(METADATA_FILENAME))?;
    Some(Project {
        name: if meta.name.trim().is_empty() {
            id.clone()
        } else {
            meta.name
        },
        description: meta.description,
        created_at: meta.created_at,
        path: dir.to_string_lossy().to_string(),
        conversation_count: count_conversations(dir),
        id,
    })
}

#[tauri::command]
pub fn list_projects(app: AppHandle) -> Result<Vec<Project>, String> {
    let root = storage::require_root(&app)?;
    let dir = storage::projects_path(&root);
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return Ok(Vec::new());
    };

    // A directory without `project.json` is something the user dropped in the
    // workspace, not a project. Skipping it keeps the list honest.
    let mut projects: Vec<Project> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_dir())
        .filter_map(|p| read_project(&p))
        .collect();

    projects.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(projects)
}

#[tauri::command]
pub fn create_project(
    app: AppHandle,
    name: String,
    description: Option<String>,
) -> Result<Project, String> {
    let root = storage::require_root(&app)?;
    let parent = storage::projects_path(&root);
    std::fs::create_dir_all(&parent).map_err(|e| format!("Create projects dir: {e}"))?;

    let name = name.trim();
    if name.is_empty() {
        return Err("Project name cannot be empty".to_string());
    }

    let id = fsutil::unique_dir_name(&parent, name);
    let dir = parent.join(&id);
    std::fs::create_dir_all(dir.join(CONVERSATIONS_DIRECTORY))
        .map_err(|e| format!("Create project dir: {e}"))?;

    let meta = ProjectMeta {
        name: name.to_string(),
        description: description.unwrap_or_default(),
        created_at: fsutil::now_rfc3339(),
    };
    fsutil::write_json(&dir.join(METADATA_FILENAME), &meta)?;

    read_project(&dir).ok_or_else(|| "Project was created but could not be read back".to_string())
}

/// Rename the display name only. The directory keeps its original name so open
/// file handles, and any path the user has already noted down, stay valid.
#[tauri::command]
pub fn rename_project(app: AppHandle, id: String, name: String) -> Result<Project, String> {
    let dir = project_dir(&app, &id)?;
    let name = name.trim();
    if name.is_empty() {
        return Err("Project name cannot be empty".to_string());
    }

    let path = dir.join(METADATA_FILENAME);
    let mut meta: ProjectMeta =
        fsutil::read_json(&path).ok_or_else(|| "Unreadable project.json".to_string())?;
    meta.name = name.to_string();
    fsutil::write_json(&path, &meta)?;

    read_project(&dir).ok_or_else(|| "Project could not be read back".to_string())
}

#[tauri::command]
pub fn update_project_description(
    app: AppHandle,
    id: String,
    description: String,
) -> Result<Project, String> {
    let dir = project_dir(&app, &id)?;
    let path = dir.join(METADATA_FILENAME);
    let mut meta: ProjectMeta =
        fsutil::read_json(&path).ok_or_else(|| "Unreadable project.json".to_string())?;
    meta.description = description;
    fsutil::write_json(&path, &meta)?;
    read_project(&dir).ok_or_else(|| "Project could not be read back".to_string())
}

/// Delete the project directory and everything under it.
///
/// This removes the user's molecule files too, so the frontend must confirm
/// before calling — there is no trash step here.
#[tauri::command]
pub fn delete_project(app: AppHandle, id: String) -> Result<(), String> {
    let dir = project_dir(&app, &id)?;
    std::fs::remove_dir_all(&dir).map_err(|e| format!("Delete project: {e}"))
}
