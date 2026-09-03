import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

import { isTauri } from "../tauri";
import { TauriStdioTransport } from "./transport";
import type { McpServerConfig } from "./api";

/**
 * Connecting to MCP servers and collecting their tools.
 *
 * # Lifecycle
 *
 * A connection lives for one answer: opened when the agent loop starts, closed
 * when it returns. Holding stdio servers open across idle time would leave the
 * user with a handful of node processes running for a chat window they stopped
 * using.
 *
 * # Naming
 *
 * Tools reach the model as `prefix__tool`. Two reasons: the model can see which
 * server it is calling, and a server whose tool is called `search` cannot
 * shadow another's. Providers constrain function names to
 * `[A-Za-z0-9_-]{1,64}`, and an illegal name fails the *whole* request rather
 * than just that one tool — so `namespaced` enforces the limit rather than
 * hoping server authors did.
 */

/** A server that refuses to start must not hold the answer hostage. */
const CONNECT_TIMEOUT_MS = 15_000;
/** Generous — some servers fetch from the network — but finite. */
export const CALL_TIMEOUT_MS = 120_000;

const MAX_TOOL_NAME = 64;

export interface McpTool {
  /** The namespaced name the model sees. */
  name: string;
  /** The bare name to send back to the server. */
  toolName: string;
  serverId: string;
  serverName: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpConnection {
  server: McpServerConfig;
  client: Client;
  close: () => Promise<void>;
}

/** Strip a name down to what every provider accepts, keeping it recognisable. */
function sanitize(part: string): string {
  return part.replace(/[^A-Za-z0-9_-]/g, "_").replace(/_{2,}/g, "_");
}

export function namespaced(serverName: string, toolName: string): string {
  const prefix = sanitize(serverName).slice(0, 24) || "mcp";
  const bare = sanitize(toolName);
  const full = `${prefix}__${bare}`;
  if (full.length <= MAX_TOOL_NAME) return full;
  // Trim the tool name rather than the prefix: which server it came from is the
  // part that disambiguates.
  return `${prefix}__${bare.slice(0, MAX_TOOL_NAME - prefix.length - 2)}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export async function connect(server: McpServerConfig): Promise<McpConnection> {
  const client = new Client({ name: "MolWhale", version: "0.1.0" }, { capabilities: {} });

  let transport;
  if (server.transport === "stdio") {
    if (!isTauri()) {
      throw new Error("stdio MCP servers need the desktop app");
    }
    // One session id per connection, not per server: two concurrent answers
    // must not share a subprocess's stdin.
    transport = new TauriStdioTransport({
      sessionId: `${server.id}-${crypto.randomUUID()}`,
      command: server.command,
      args: server.args,
      env: server.env,
      cwd: server.cwd,
    });
  } else {
    transport = new StreamableHTTPClientTransport(new URL(server.url), {
      requestInit: { headers: server.headers },
      // Route through Tauri's HTTP stack so the webview's CORS rules — which a
      // remote MCP endpoint has no reason to satisfy — do not apply.
      fetch: isTauri() ? (tauriFetch as unknown as typeof fetch) : undefined,
    });
  }

  await withTimeout(client.connect(transport), CONNECT_TIMEOUT_MS, `Connecting to ${server.name}`);

  return {
    server,
    client,
    close: async () => {
      try {
        await client.close();
      } catch {
        // A server that already exited throws here; the process is gone either
        // way, which is all close needs to guarantee.
      }
    },
  };
}

export async function listTools(connection: McpConnection): Promise<McpTool[]> {
  const { tools } = await connection.client.listTools();
  return tools.map((tool) => ({
    name: namespaced(connection.server.name, tool.name),
    toolName: tool.name,
    serverId: connection.server.id,
    serverName: connection.server.name,
    description: tool.description ?? "",
    inputSchema: (tool.inputSchema ?? { type: "object", properties: {} }) as Record<
      string,
      unknown
    >,
  }));
}

/**
 * Open every enabled server, returning the connections that came up.
 *
 * A server that fails to start is reported but does not abort the batch: one
 * broken entry in the settings list should cost its own tools, not the answer.
 */
export async function connectAll(
  servers: McpServerConfig[],
): Promise<{ connections: McpConnection[]; errors: { server: string; message: string }[] }> {
  const results = await Promise.allSettled(servers.filter((s) => s.enabled).map((s) => connect(s)));

  const connections: McpConnection[] = [];
  const errors: { server: string; message: string }[] = [];
  results.forEach((result, index) => {
    const server = servers.filter((s) => s.enabled)[index];
    if (result.status === "fulfilled") connections.push(result.value);
    else errors.push({ server: server.name, message: String(result.reason) });
  });

  return { connections, errors };
}

export async function closeAll(connections: McpConnection[]): Promise<void> {
  await Promise.allSettled(connections.map((c) => c.close()));
}
