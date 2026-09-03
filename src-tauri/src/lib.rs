mod config;
mod conversations;
mod fsutil;
mod mcp;
mod projects;
mod providers;
mod storage;

use config::{get_settings, set_settings};
use conversations::{
    append_message, create_conversation, delete_conversation, list_conversations, list_messages,
    rename_conversation, replace_messages, set_conversation_model,
};
use mcp::{
    mcp_close, mcp_delete_server, mcp_list_servers, mcp_send, mcp_spawn, mcp_stderr,
    mcp_upsert_server, McpSessions,
};
use projects::{
    create_project, delete_project, list_projects, rename_project, update_project_description,
};
use providers::{
    delete_provider, get_provider_key, list_providers, set_provider_default_model,
    set_provider_key, set_provider_models, upsert_provider,
};
use storage::{get_storage_status, set_storage_root};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .manage(McpSessions::default())
        .invoke_handler(tauri::generate_handler![
            // storage
            get_storage_status,
            set_storage_root,
            // settings
            get_settings,
            set_settings,
            // projects
            list_projects,
            create_project,
            rename_project,
            update_project_description,
            delete_project,
            // conversations
            list_conversations,
            create_conversation,
            rename_conversation,
            set_conversation_model,
            delete_conversation,
            list_messages,
            append_message,
            replace_messages,
            // providers
            list_providers,
            upsert_provider,
            delete_provider,
            set_provider_key,
            get_provider_key,
            set_provider_models,
            set_provider_default_model,
            // mcp
            mcp_list_servers,
            mcp_upsert_server,
            mcp_delete_server,
            mcp_spawn,
            mcp_send,
            mcp_stderr,
            mcp_close,
        ])
        .on_window_event(|window, event| {
            // Quitting must not leave a handful of MCP subprocesses running.
            if matches!(event, tauri::WindowEvent::Destroyed) {
                mcp::shutdown_all(window.app_handle());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running MolWhale");
}
