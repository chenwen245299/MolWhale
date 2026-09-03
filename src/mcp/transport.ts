import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

import { mcpClose, mcpSend, mcpSpawn, type SpawnRequest } from "./api";

/**
 * A `Transport` for the official MCP SDK that runs the server as a Tauri-managed
 * child process.
 *
 * The SDK ships its own `StdioClientTransport`, but it needs Node's
 * `child_process` — unavailable in a webview. So Rust owns the process and the
 * line framing (see `src-tauri/src/mcp.rs`) and this class is just the pipe:
 * `send` pushes a line down, an event listener pushes lines back up. Everything
 * above it — initialization, tool listing, request correlation — is the SDK's
 * own, unmodified.
 */
export class TauriStdioTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  private unlistenMessage?: UnlistenFn;
  private unlistenExit?: UnlistenFn;
  private started = false;
  private closed = false;

  constructor(private readonly request: SpawnRequest) {}

  async start(): Promise<void> {
    if (this.started) throw new Error("Transport already started");
    this.started = true;

    // Subscribe before spawning: a fast server can emit its first line before
    // the spawn call's promise resolves, and that line must not be dropped.
    this.unlistenMessage = await listen<string>(`mcp:msg:${this.request.sessionId}`, (event) => {
      if (this.closed) return;
      try {
        this.onmessage?.(JSON.parse(event.payload) as JSONRPCMessage);
      } catch (error) {
        // A non-JSON line is a server writing debug output to stdout, which
        // is a protocol violation but a common one. Report it and keep going
        // rather than tearing down the session.
        this.onerror?.(
          new Error(
            `Non-JSON line from MCP server: ${event.payload.slice(0, 200)} (${String(error)})`,
          ),
        );
      }
    });

    this.unlistenExit = await listen(`mcp:exit:${this.request.sessionId}`, () => {
      void this.handleClose();
    });

    try {
      await mcpSpawn(this.request);
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.closed) throw new Error("Transport is closed");
    await mcpSend(this.request.sessionId, JSON.stringify(message));
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.unlistenMessage?.();
    this.unlistenExit?.();
    this.unlistenMessage = undefined;
    this.unlistenExit = undefined;
    try {
      await mcpClose(this.request.sessionId);
    } finally {
      this.onclose?.();
    }
  }

  private async handleClose(): Promise<void> {
    if (this.closed) return;
    await this.close();
  }
}
