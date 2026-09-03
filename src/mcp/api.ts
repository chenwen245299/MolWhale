import { invoke, isTauri } from "../tauri";

export type McpTransport = "stdio" | "http";

export interface McpServerConfig {
  id: string;
  name: string;
  transport: McpTransport;
  enabled: boolean;

  // stdio
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;

  // http
  url: string;
  headers: Record<string, string>;

  createdAt: string;
}

export function emptyServer(transport: McpTransport = "stdio"): McpServerConfig {
  return {
    id: "",
    name: "",
    transport,
    enabled: true,
    command: "",
    args: [],
    env: {},
    cwd: "",
    url: "",
    headers: {},
    createdAt: "",
  };
}

const preview: { servers: McpServerConfig[] } = { servers: [] };

export async function listMcpServers(): Promise<McpServerConfig[]> {
  if (isTauri()) return invoke<McpServerConfig[]>("mcp_list_servers");
  return [...preview.servers];
}

export async function upsertMcpServer(server: McpServerConfig): Promise<McpServerConfig> {
  if (isTauri()) return invoke<McpServerConfig>("mcp_upsert_server", { server });
  const next = { ...server, id: server.id || `mcp-${Date.now()}` };
  const index = preview.servers.findIndex((s) => s.id === next.id);
  if (index >= 0) preview.servers[index] = next;
  else preview.servers = [...preview.servers, next];
  return next;
}

export async function deleteMcpServer(id: string): Promise<void> {
  if (isTauri()) return invoke<void>("mcp_delete_server", { id });
  preview.servers = preview.servers.filter((s) => s.id !== id);
}

// ── stdio bridge (used by transport.ts, not by UI code) ──────────────────────

export interface SpawnRequest {
  sessionId: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
}

export const mcpSpawn = (request: SpawnRequest) => invoke<void>("mcp_spawn", { request });

export const mcpSend = (sessionId: string, line: string) =>
  invoke<void>("mcp_send", { sessionId, line });

export const mcpClose = (sessionId: string) => invoke<void>("mcp_close", { sessionId });

export const mcpStderr = (sessionId: string) => invoke<string[]>("mcp_stderr", { sessionId });
