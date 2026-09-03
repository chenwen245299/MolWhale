//! Conversations: one directory each, under `<project>/conversations/`.
//!
//! # Why a directory per conversation
//!
//! Molecular design turns a chat into a pile of artifacts — structures, docked
//! poses, property tables, plots. Giving each conversation its own `files/`
//! directory means a tool can just write into the conversation's folder and the
//! user can open that folder to find exactly the outputs of that thread.
//!
//! # Why `messages.jsonl`
//!
//! Append-only. A streamed answer is finalized once and appended as one line,
//! so a long conversation never rewrites its whole history, and a truncated
//! last line (crash mid-append) costs one message rather than the file.

use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;

use crate::fsutil;
use crate::projects;

pub const METADATA_FILENAME: &str = "conversation.json";
pub const MESSAGES_FILENAME: &str = "messages.jsonl";
pub const FILES_DIRECTORY: &str = "files";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationMeta {
    pub title: String,
    #[serde(default)]
    pub provider_id: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Conversation {
    /// Directory name under the project's `conversations/`.
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub provider_id: Option<String>,
    pub model: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub path: String,
    pub files_path: String,
}

fn conversation_dir(app: &AppHandle, project_id: &str, id: &str) -> Result<PathBuf, String> {
    let id = fsutil::safe_segment(id)?;
    let dir = projects::conversations_dir(app, project_id)?.join(id);
    if !dir.is_dir() {
        return Err(format!("No such conversation: {id}"));
    }
    Ok(dir)
}

fn read_conversation(dir: &Path, project_id: &str) -> Option<Conversation> {
    let id = dir.file_name()?.to_string_lossy().to_string();
    let meta: ConversationMeta = fsutil::read_json(&dir.join(METADATA_FILENAME))?;
    Some(Conversation {
        title: if meta.title.trim().is_empty() {
            id.clone()
        } else {
            meta.title
        },
        project_id: project_id.to_string(),
        provider_id: meta.provider_id,
        model: meta.model,
        created_at: meta.created_at,
        updated_at: meta.updated_at,
        path: dir.to_string_lossy().to_string(),
        files_path: dir.join(FILES_DIRECTORY).to_string_lossy().to_string(),
        id,
    })
}

fn touch(dir: &Path) -> Result<ConversationMeta, String> {
    let path = dir.join(METADATA_FILENAME);
    let mut meta: ConversationMeta =
        fsutil::read_json(&path).ok_or_else(|| "Unreadable conversation.json".to_string())?;
    meta.updated_at = fsutil::now_rfc3339();
    fsutil::write_json(&path, &meta)?;
    Ok(meta)
}

#[tauri::command]
pub fn list_conversations(app: AppHandle, project_id: String) -> Result<Vec<Conversation>, String> {
    let dir = projects::conversations_dir(&app, &project_id)?;
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return Ok(Vec::new());
    };

    let mut conversations: Vec<Conversation> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_dir())
        .filter_map(|p| read_conversation(&p, &project_id))
        .collect();

    // Most recently touched first — the same order the sidebar shows.
    conversations.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(conversations)
}

/// Create a conversation inside `project_id`.
///
/// There is deliberately no way to create one without a project: resolving the
/// project directory is the first thing this does, and it fails if the project
/// does not exist.
#[tauri::command]
pub fn create_conversation(
    app: AppHandle,
    project_id: String,
    title: Option<String>,
    provider_id: Option<String>,
    model: Option<String>,
) -> Result<Conversation, String> {
    let parent = projects::conversations_dir(&app, &project_id)?;
    std::fs::create_dir_all(&parent).map_err(|e| format!("Create conversations dir: {e}"))?;

    let title = title.unwrap_or_default();
    let title = if title.trim().is_empty() {
        "新对话"
    } else {
        title.trim()
    };

    let id = fsutil::unique_dir_name(&parent, title);
    let dir = parent.join(&id);
    std::fs::create_dir_all(dir.join(FILES_DIRECTORY))
        .map_err(|e| format!("Create conversation dir: {e}"))?;

    let now = fsutil::now_rfc3339();
    let meta = ConversationMeta {
        title: title.to_string(),
        provider_id,
        model,
        created_at: now.clone(),
        updated_at: now,
    };
    fsutil::write_json(&dir.join(METADATA_FILENAME), &meta)?;
    // Create the log up front so "no messages yet" and "file missing" are the
    // same, empty, case for the reader.
    std::fs::write(dir.join(MESSAGES_FILENAME), b"")
        .map_err(|e| format!("Create messages log: {e}"))?;

    read_conversation(&dir, &project_id)
        .ok_or_else(|| "Conversation was created but could not be read back".to_string())
}

#[tauri::command]
pub fn rename_conversation(
    app: AppHandle,
    project_id: String,
    id: String,
    title: String,
) -> Result<Conversation, String> {
    let dir = conversation_dir(&app, &project_id, &id)?;
    let title = title.trim();
    if title.is_empty() {
        return Err("Conversation title cannot be empty".to_string());
    }

    let path = dir.join(METADATA_FILENAME);
    let mut meta: ConversationMeta =
        fsutil::read_json(&path).ok_or_else(|| "Unreadable conversation.json".to_string())?;
    meta.title = title.to_string();
    meta.updated_at = fsutil::now_rfc3339();
    fsutil::write_json(&path, &meta)?;

    read_conversation(&dir, &project_id)
        .ok_or_else(|| "Conversation could not be read back".to_string())
}

/// Remember the provider/model the user picked for this thread, so reopening it
/// does not silently fall back to the global default.
#[tauri::command]
pub fn set_conversation_model(
    app: AppHandle,
    project_id: String,
    id: String,
    provider_id: Option<String>,
    model: Option<String>,
) -> Result<Conversation, String> {
    let dir = conversation_dir(&app, &project_id, &id)?;
    let path = dir.join(METADATA_FILENAME);
    let mut meta: ConversationMeta =
        fsutil::read_json(&path).ok_or_else(|| "Unreadable conversation.json".to_string())?;
    meta.provider_id = provider_id;
    meta.model = model;
    meta.updated_at = fsutil::now_rfc3339();
    fsutil::write_json(&path, &meta)?;

    read_conversation(&dir, &project_id)
        .ok_or_else(|| "Conversation could not be read back".to_string())
}

#[tauri::command]
pub fn delete_conversation(app: AppHandle, project_id: String, id: String) -> Result<(), String> {
    let dir = conversation_dir(&app, &project_id, &id)?;
    std::fs::remove_dir_all(&dir).map_err(|e| format!("Delete conversation: {e}"))
}

/// Every message in the thread, oldest first.
///
/// A line that fails to parse is skipped rather than fatal: the only way to get
/// one is a crash during the final append, and losing that message is a much
/// better outcome than refusing to open the conversation.
#[tauri::command]
pub fn list_messages(app: AppHandle, project_id: String, id: String) -> Result<Vec<Value>, String> {
    let dir = conversation_dir(&app, &project_id, &id)?;
    let path = dir.join(MESSAGES_FILENAME);
    let Ok(content) = std::fs::read_to_string(&path) else {
        return Ok(Vec::new());
    };
    Ok(content
        .lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|l| serde_json::from_str(l).ok())
        .collect())
}

/// Append one finalized message. The frontend owns the message shape; Rust only
/// guarantees one JSON object per line.
#[tauri::command]
pub fn append_message(
    app: AppHandle,
    project_id: String,
    id: String,
    message: Value,
) -> Result<(), String> {
    let dir = conversation_dir(&app, &project_id, &id)?;
    let line = serde_json::to_string(&message).map_err(|e| format!("Serialize message: {e}"))?;

    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join(MESSAGES_FILENAME))
        .map_err(|e| format!("Open messages log: {e}"))?;
    writeln!(file, "{line}").map_err(|e| format!("Append message: {e}"))?;

    touch(&dir)?;
    Ok(())
}

/// Rewrite the whole log. Used for edit/delete of an existing message, where
/// append-only cannot express the change.
#[tauri::command]
pub fn replace_messages(
    app: AppHandle,
    project_id: String,
    id: String,
    messages: Vec<Value>,
) -> Result<(), String> {
    let dir = conversation_dir(&app, &project_id, &id)?;
    let mut content = String::new();
    for message in &messages {
        content.push_str(&serde_json::to_string(message).map_err(|e| format!("Serialize: {e}"))?);
        content.push('\n');
    }
    fsutil::atomic_write_str(&dir.join(MESSAGES_FILENAME), &content)?;
    touch(&dir)?;
    Ok(())
}
