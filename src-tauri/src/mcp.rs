//! MCP server configuration, and a stdio bridge for the ones that are local
//! subprocesses.
//!
//! # Division of labour
//!
//! A webview cannot spawn a process, so stdio MCP servers need Rust. But Rust
//! deliberately does **not** speak MCP here: it spawns the child, frames its
//! stdout into lines, and pumps lines back down stdin. The JSON-RPC, the
//! capability negotiation, the tool schemas — all of that stays in
//! `@modelcontextprotocol/sdk` on the JS side, behind a custom `Transport`
//! (see `src/mcp/transport.ts`). That way the protocol implementation is the
//! official one and this file never has to track spec revisions.
//!
//! HTTP servers skip this module entirely; the JS SDK talks to them directly.
//!
//! # Trust
//!
//! A configured stdio server is an arbitrary program launched with the user's
//! privileges. That is inherent to the transport and true of every MCP client
//! that speaks it. The protections are that the list starts empty, each entry
//! can be disabled without being deleted, and the count is capped.

use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};

use crate::config;
use crate::fsutil;

/// Upper bound on configured servers. Every enabled one is a process spawned
/// per answer, so this guards against a config that makes the app unusable.
pub const MAX_SERVERS: usize = 20;

/// Event name carrying one line of a session's stdout. The frontend listens on
/// `mcp:msg:<sessionId>`.
fn message_event(session_id: &str) -> String {
    format!("mcp:msg:{session_id}")
}

/// Event fired once when a session's child process exits on its own.
fn exit_event(session_id: &str) -> String {
    format!("mcp:exit:{session_id}")
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpServerConfig {
    pub id: String,
    /// Shown in the UI and used to derive the tool prefix.
    pub name: String,
    /// `stdio` or `http`.
    pub transport: String,
    #[serde(default = "bool_true")]
    pub enabled: bool,

    // ── stdio ────────────────────────────────────────────────────────────────
    /// Executable to launch. Absolute paths are safest: a GUI app inherits a
    /// login shell's PATH only sometimes, so a bare `npx` can resolve when run
    /// from a terminal and fail when launched from Finder.
    #[serde(default)]
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    /// Working directory. Empty means the workspace root.
    #[serde(default)]
    pub cwd: String,

    // ── http ─────────────────────────────────────────────────────────────────
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,

    #[serde(default)]
    pub created_at: String,
}

fn bool_true() -> bool {
    true
}

// ── Configuration commands ───────────────────────────────────────────────────

#[tauri::command]
pub fn mcp_list_servers(app: AppHandle) -> Result<Vec<McpServerConfig>, String> {
    Ok(config::load(&app)?.mcp_servers)
}

#[tauri::command]
pub fn mcp_upsert_server(
    app: AppHandle,
    server: McpServerConfig,
) -> Result<McpServerConfig, String> {
    config::update(&app, |cfg| {
        let mut server = server;
        if server.name.trim().is_empty() {
            return Err("Server name cannot be empty".to_string());
        }
        match server.transport.as_str() {
            "stdio" if server.command.trim().is_empty() => {
                return Err("A stdio server needs a command".to_string())
            }
            "http" if server.url.trim().is_empty() => {
                return Err("An HTTP server needs a URL".to_string())
            }
            "stdio" | "http" => {}
            other => return Err(format!("Unknown transport: {other}")),
        }

        match cfg.mcp_servers.iter_mut().find(|s| s.id == server.id) {
            Some(existing) => {
                server.created_at = existing.created_at.clone();
                *existing = server.clone();
            }
            None => {
                if cfg.mcp_servers.len() >= MAX_SERVERS {
                    return Err(format!("At most {MAX_SERVERS} MCP servers"));
                }
                if server.id.trim().is_empty() {
                    server.id = uuid::Uuid::new_v4().to_string();
                }
                server.created_at = fsutil::now_rfc3339();
                cfg.mcp_servers.push(server.clone());
            }
        }
        Ok(server)
    })
}

#[tauri::command]
pub fn mcp_delete_server(app: AppHandle, id: String) -> Result<(), String> {
    config::update(&app, |cfg| {
        cfg.mcp_servers.retain(|s| s.id != id);
        Ok(())
    })
}

// ── stdio bridge ─────────────────────────────────────────────────────────────

struct Session {
    child: Child,
    /// Behind an async mutex so a write can be awaited while held. The session
    /// *table* uses a sync mutex, so `mcp_send` clones this Arc out of the table
    /// first and never holds the table lock across an await.
    stdin: Arc<tokio::sync::Mutex<ChildStdin>>,
    /// Recent stderr, kept so a server that fails to start can explain itself
    /// in the settings UI instead of just "connection closed".
    stderr: Arc<Mutex<Vec<String>>>,
}

#[derive(Default)]
pub struct McpSessions(Mutex<HashMap<String, Session>>);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnRequest {
    pub session_id: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub cwd: String,
}

/// Launch a stdio MCP server and start pumping its stdout to the frontend.
#[tauri::command]
pub async fn mcp_spawn(
    app: AppHandle,
    sessions: State<'_, McpSessions>,
    request: SpawnRequest,
) -> Result<(), String> {
    if request.session_id.trim().is_empty() {
        return Err("sessionId is required".to_string());
    }
    // A re-spawn on a live id would orphan the old child, so close it first.
    close_session(&sessions, &request.session_id);

    let mut command = Command::new(&request.command);
    command
        .args(&request.args)
        .envs(&request.env)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let cwd = if request.cwd.trim().is_empty() {
        crate::storage::require_root(&app).ok()
    } else {
        Some(std::path::PathBuf::from(&request.cwd))
    };
    if let Some(cwd) = cwd.filter(|p| p.is_dir()) {
        command.current_dir(cwd);
    }

    #[cfg(windows)]
    {
        // Without this every server flashes a console window.
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("Launch {}: {e}", request.command))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "No stdin pipe".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "No stdout pipe".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "No stderr pipe".to_string())?;

    let log = Arc::new(Mutex::new(Vec::<String>::new()));

    // stdout → frontend, one JSON-RPC message per line.
    {
        let app = app.clone();
        let session_id = request.session_id.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if line.trim().is_empty() {
                    continue;
                }
                let _ = app.emit(&message_event(&session_id), line);
            }
            // stdout closing means the server is done talking to us.
            let _ = app.emit(&exit_event(&session_id), ());
        });
    }

    // stderr → ring buffer for diagnostics.
    {
        let log = log.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if let Ok(mut log) = log.lock() {
                    if log.len() >= 200 {
                        log.remove(0);
                    }
                    log.push(line);
                }
            }
        });
    }

    if let Ok(mut map) = sessions.0.lock() {
        map.insert(
            request.session_id,
            Session {
                child,
                stdin: Arc::new(tokio::sync::Mutex::new(stdin)),
                stderr: log,
            },
        );
    }
    Ok(())
}

/// Write one JSON-RPC message to a session's stdin.
#[tauri::command]
pub async fn mcp_send(
    sessions: State<'_, McpSessions>,
    session_id: String,
    line: String,
) -> Result<(), String> {
    // Clone the Arc out under the sync lock, then release the table before
    // awaiting the write.
    let stdin = {
        let map = sessions
            .0
            .lock()
            .map_err(|_| "MCP session table is poisoned".to_string())?;
        map.get(&session_id)
            .ok_or_else(|| format!("No such MCP session: {session_id}"))?
            .stdin
            .clone()
    };

    let mut stdin = stdin.lock().await;
    stdin
        .write_all(format!("{line}\n").as_bytes())
        .await
        .map_err(|e| format!("Write to MCP server: {e}"))?;
    stdin.flush().await.map_err(|e| format!("Flush: {e}"))
}

/// Recent stderr from a session, for the settings UI's error panel.
#[tauri::command]
pub fn mcp_stderr(
    sessions: State<'_, McpSessions>,
    session_id: String,
) -> Result<Vec<String>, String> {
    let map = sessions
        .0
        .lock()
        .map_err(|_| "MCP session table is poisoned".to_string())?;
    let Some(session) = map.get(&session_id) else {
        return Ok(Vec::new());
    };
    let log = session
        .stderr
        .lock()
        .map_err(|_| "stderr log is poisoned".to_string())?;
    Ok(log.clone())
}

fn close_session(sessions: &McpSessions, session_id: &str) {
    if let Ok(mut map) = sessions.0.lock() {
        if let Some(mut session) = map.remove(session_id) {
            let _ = session.child.start_kill();
        }
    }
}

#[tauri::command]
pub fn mcp_close(sessions: State<'_, McpSessions>, session_id: String) -> Result<(), String> {
    close_session(&sessions, &session_id);
    Ok(())
}

/// Kill every live session. Called on window close so a quit does not leave
/// node processes behind.
pub fn shutdown_all(app: &AppHandle) {
    let state = app.state::<McpSessions>();
    let sessions: &McpSessions = state.inner();
    if let Ok(mut map) = sessions.0.lock() {
        for (_, mut session) in map.drain() {
            let _ = session.child.start_kill();
        }
    }
}
