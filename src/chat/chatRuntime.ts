import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

import { getProviderKey, type ProviderInfo } from "../providers/api";
import {
  CALL_TIMEOUT_MS,
  closeAll,
  connectAll,
  listTools,
  type McpConnection,
  type McpTool,
} from "../mcp/client";
import type { McpServerConfig } from "../mcp/api";
import { isTauri } from "../tauri";
import type { ChatMessage, ToolInvocation } from "./types";
import { newMessage } from "./types";

/**
 * The agent loop.
 *
 * Runs in the webview rather than Rust, which is why `getProviderKey` exists —
 * see the note on that function. Everything here is the official OpenAI SDK
 * pointed at an OpenAI-compatible base URL (OpenRouter by default), plus a tool
 * loop that dispatches to MCP servers.
 */

export interface RunOptions {
  provider: ProviderInfo;
  model: string;
  history: ChatMessage[];
  systemPrompt?: string;
  maxToolRounds: number;
  mcpServers: McpServerConfig[];
  signal: AbortSignal;
  /** Called on every content delta with the full text so far. */
  onDelta: (text: string) => void;
  /** Called whenever the tool-call list for this turn changes. */
  onToolCalls: (calls: ToolInvocation[]) => void;
  onStatus?: (status: string) => void;
}

/** Fold MolWhale's turn-shaped history back into the API's flat message list. */
function toWireMessages(
  history: ChatMessage[],
  systemPrompt?: string,
): ChatCompletionMessageParam[] {
  const wire: ChatCompletionMessageParam[] = [];
  if (systemPrompt?.trim()) {
    wire.push({ role: "system", content: systemPrompt.trim() });
  }

  for (const message of history) {
    if (message.role === "user" || message.role === "system") {
      wire.push({ role: message.role, content: message.content });
      continue;
    }

    const calls = message.toolCalls ?? [];
    if (calls.length === 0) {
      // An assistant turn with no text and no calls (an aborted stream) would
      // be rejected by some providers; skip it rather than send an empty turn.
      if (message.content.trim()) wire.push({ role: "assistant", content: message.content });
      continue;
    }

    wire.push({
      role: "assistant",
      content: message.content || null,
      tool_calls: calls.map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.name, arguments: call.arguments },
      })),
    });
    for (const call of calls) {
      wire.push({
        role: "tool",
        tool_call_id: call.id,
        content: call.result ?? "",
      });
    }
  }

  return wire;
}

function toOpenAITools(tools: McpTool[]): ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

async function buildClient(provider: ProviderInfo): Promise<OpenAI> {
  const apiKey = await getProviderKey(provider.id);
  return new OpenAI({
    apiKey,
    baseURL: provider.baseUrl,
    // The SDK refuses to run in a browser-like environment without this. The
    // usual reason for that guard — shipping a key to untrusted clients — does
    // not apply: this webview is the desktop app itself.
    dangerouslyAllowBrowser: true,
    // Tauri's HTTP stack, so requests are not subject to the webview's CORS
    // rules and the key never rides on a page-visible XHR.
    fetch: isTauri() ? (tauriFetch as unknown as typeof fetch) : undefined,
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

async function dispatchTool(
  call: ToolInvocation,
  tools: McpTool[],
  connections: McpConnection[],
): Promise<{ result: string; isError: boolean }> {
  const tool = tools.find((t) => t.name === call.name);
  if (!tool) {
    return { result: `Unknown tool: ${call.name}`, isError: true };
  }
  const connection = connections.find((c) => c.server.id === tool.serverId);
  if (!connection) {
    return { result: `Server for ${call.name} is not connected`, isError: true };
  }

  let args: Record<string, unknown>;
  try {
    args = call.arguments.trim() ? JSON.parse(call.arguments) : {};
  } catch {
    // Malformed arguments are the model's mistake, and telling it so is more
    // useful than failing the turn — it usually corrects on the next round.
    return { result: `Arguments were not valid JSON: ${call.arguments}`, isError: true };
  }

  try {
    const response = await withTimeout(
      connection.client.callTool({ name: tool.toolName, arguments: args }),
      CALL_TIMEOUT_MS,
      `${call.name}`,
    );
    const content = Array.isArray(response.content) ? response.content : [];
    const text = content
      .map((part: { type?: string; text?: string }) =>
        part.type === "text" ? (part.text ?? "") : `[${part.type ?? "unknown"}]`,
      )
      .join("\n");
    return { result: text || "(empty result)", isError: Boolean(response.isError) };
  } catch (error) {
    return { result: String(error), isError: true };
  }
}

/**
 * Run one turn to completion, streaming as it goes.
 *
 * Returns the finished assistant message. MCP connections are opened here and
 * closed in the `finally`, so a turn never leaks a subprocess.
 */
export async function runTurn(options: RunOptions): Promise<ChatMessage> {
  const {
    provider,
    model,
    history,
    systemPrompt,
    maxToolRounds,
    mcpServers,
    signal,
    onDelta,
    onToolCalls,
    onStatus,
  } = options;

  const assistant = newMessage("assistant", "");
  let connections: McpConnection[] = [];

  try {
    const client = await buildClient(provider);

    let tools: McpTool[] = [];
    if (mcpServers.some((s) => s.enabled)) {
      onStatus?.("connecting-mcp");
      const opened = await connectAll(mcpServers);
      connections = opened.connections;
      const listed = await Promise.allSettled(connections.map((c) => listTools(c)));
      tools = listed.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    }

    const wire = toWireMessages(history, systemPrompt);
    const openAITools = toOpenAITools(tools);
    const allCalls: ToolInvocation[] = [];
    let text = "";

    for (let round = 0; round < Math.max(1, maxToolRounds); round += 1) {
      if (signal.aborted) break;
      onStatus?.("streaming");

      const stream = await client.chat.completions.create(
        {
          model,
          messages: wire,
          stream: true,
          ...(openAITools.length > 0 ? { tools: openAITools } : {}),
        },
        { signal },
      );

      // Tool calls arrive as deltas indexed by position, so they are assembled
      // in a sparse array before being turned into invocations.
      const pending: { id: string; name: string; arguments: string }[] = [];
      let roundText = "";

      for await (const chunk of stream) {
        if (signal.aborted) break;
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          roundText += delta.content;
          text += delta.content;
          onDelta(text);
        }

        for (const call of delta.tool_calls ?? []) {
          const slot = (pending[call.index] ??= { id: "", name: "", arguments: "" });
          if (call.id) slot.id = call.id;
          if (call.function?.name) slot.name += call.function.name;
          if (call.function?.arguments) slot.arguments += call.function.arguments;
        }
      }

      const calls = pending.filter(Boolean);
      if (calls.length === 0 || signal.aborted) break;

      // Record the assistant's request before running anything, so a slow tool
      // still shows up in the UI as "called, waiting".
      const invocations: ToolInvocation[] = calls.map((call) => ({
        id: call.id || crypto.randomUUID(),
        name: call.name,
        arguments: call.arguments,
      }));
      allCalls.push(...invocations);
      onToolCalls([...allCalls]);

      wire.push({
        role: "assistant",
        content: roundText || null,
        tool_calls: invocations.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: { name: call.name, arguments: call.arguments },
        })),
      });

      onStatus?.("running-tools");
      for (const invocation of invocations) {
        const { result, isError } = await dispatchTool(invocation, tools, connections);
        invocation.result = result;
        invocation.isError = isError;
        onToolCalls([...allCalls]);
        wire.push({ role: "tool", tool_call_id: invocation.id, content: result });
      }
    }

    assistant.content = text;
    if (allCalls.length > 0) assistant.toolCalls = allCalls;
    return assistant;
  } catch (error) {
    // An abort is the user pressing stop, not a failure worth an error banner.
    if (signal.aborted) return assistant;
    assistant.error = error instanceof Error ? error.message : String(error);
    return assistant;
  } finally {
    onStatus?.("idle");
    await closeAll(connections);
  }
}

/**
 * Ask the provider for its model list.
 *
 * Kept here rather than in Rust so there is exactly one place that knows how to
 * build an authenticated client.
 */
export async function fetchModels(provider: ProviderInfo): Promise<{ id: string; name: string }[]> {
  const client = await buildClient(provider);
  const response = await client.models.list();
  return response.data
    .map((model) => ({ id: model.id, name: model.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
