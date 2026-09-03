import { useCallback, useEffect, useRef, useState } from "react";

import { listMcpServers, type McpServerConfig } from "../mcp/api";
import { appendMessage, listMessages, type Conversation } from "../projects/api";
import type { ProviderInfo } from "../providers/api";
import type { AppSettings } from "../settings/api";
import { runTurn } from "./chatRuntime";
import { newMessage, type ChatMessage, type ToolInvocation } from "./types";

/**
 * Chat state for one conversation.
 *
 * Persistence is deliberately coarse: only *finalized* messages are written, one
 * append each. The streaming text lives in React state alone, so a long answer
 * does not touch the disk once per token.
 */
export function useChat({
  conversation,
  providers,
  settings,
}: {
  conversation: Conversation | null;
  providers: ProviderInfo[];
  settings: AppSettings;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolInvocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mcpServers, setMcpServers] = useState<McpServerConfig[]>([]);

  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listMcpServers()
      .then((servers) => {
        if (!cancelled) setMcpServers(servers);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ChatPane is keyed by conversation id, so this hook is remounted whenever
  // the thread changes — there is no stale streaming state to clear here, and
  // `cancelled` only has to cover an unmount mid-load.
  useEffect(() => {
    if (!conversation) return;
    let cancelled = false;

    void listMessages(conversation.projectId, conversation.id)
      .then((stored) => {
        if (!cancelled) setMessages(stored as unknown as ChatMessage[]);
      })
      .catch((cause) => {
        if (!cancelled) setError(String(cause));
      });

    return () => {
      cancelled = true;
      abort.current?.abort();
    };
  }, [conversation]);

  const stop = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
    setStreaming(false);
  }, []);

  const send = useCallback(
    async (text: string, providerId: string | null, model: string | null) => {
      if (!conversation || !text.trim()) return;

      const provider = providers.find((p) => p.id === providerId);
      if (!provider) {
        setError("请先在设置里配置模型服务");
        return;
      }
      if (!model) {
        setError("请先选择一个模型");
        return;
      }

      setError(null);
      const user = newMessage("user", text.trim());
      const history = [...messages, user];
      setMessages(history);
      await appendMessage(conversation.projectId, conversation.id, user as never);

      const controller = new AbortController();
      abort.current = controller;
      setStreaming(true);
      setStreamingText("");
      setStreamingToolCalls([]);

      const assistant = await runTurn({
        provider,
        model,
        history,
        systemPrompt: settings.systemPrompt,
        maxToolRounds: settings.maxToolRounds,
        mcpServers,
        signal: controller.signal,
        onDelta: setStreamingText,
        onToolCalls: setStreamingToolCalls,
      });

      abort.current = null;
      setStreaming(false);
      setStreamingText("");
      setStreamingToolCalls([]);

      // An aborted turn with nothing to show is the user cancelling before the
      // first token; there is no message worth keeping.
      if (assistant.content || assistant.toolCalls?.length || assistant.error) {
        setMessages((current) => [...current, assistant]);
        await appendMessage(conversation.projectId, conversation.id, assistant as never);
      }
      if (assistant.error) setError(assistant.error);
    },
    [conversation, mcpServers, messages, providers, settings.maxToolRounds, settings.systemPrompt],
  );

  return {
    messages,
    streaming,
    streamingText,
    streamingToolCalls,
    error,
    setError,
    send,
    stop,
    mcpServers,
    reloadMcpServers: () =>
      void listMcpServers()
        .then(setMcpServers)
        .catch(() => {}),
  };
}
