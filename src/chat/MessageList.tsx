import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";

import { useT } from "../i18n";
import { radius, space, type as typeScale, useTokens } from "../theme";
import type { ChatMessage, ToolInvocation } from "./types";

/**
 * The transcript.
 *
 * Assistant text is rendered as pre-wrapped plain text rather than markdown:
 * this is the scaffold, and a markdown pipeline is a real dependency decision
 * (sanitisation, code highlighting, KaTeX for the chemistry) better made when
 * the panels beside it are decided too.
 */
export function MessageList({
  messages,
  streaming,
  streamingText,
  streamingToolCalls,
}: {
  messages: ChatMessage[];
  streaming: boolean;
  streamingText: string;
  streamingToolCalls: ToolInvocation[];
}) {
  const tokens = useTokens();
  const scroller = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  // Follow the stream, but stop following the moment the user scrolls up to
  // read something — snapping them back mid-read is the classic chat-UI sin.
  useEffect(() => {
    const element = scroller.current;
    if (!element || !pinnedToBottom.current) return;
    element.scrollTop = element.scrollHeight;
  }, [messages, streamingText, streamingToolCalls]);

  return (
    <div
      ref={scroller}
      onScroll={(event) => {
        const element = event.currentTarget;
        const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
        pinnedToBottom.current = distance < 40;
      }}
      style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: space(6),
        padding: `${space(6)}px 0 ${space(4)}px`,
      }}
    >
      {messages.map((message) => (
        <Turn key={message.id} message={message} />
      ))}

      {streaming ? (
        <Turn
          message={{
            id: "streaming",
            role: "assistant",
            content: streamingText,
            createdAt: "",
            toolCalls: streamingToolCalls.length ? streamingToolCalls : undefined,
          }}
          pending
        />
      ) : null}

      <div
        style={{ height: 1, flex: "0 0 auto", background: "transparent", color: tokens.scrim }}
      />
    </div>
  );
}

function Turn({ message, pending }: { message: ChatMessage; pending?: boolean }) {
  const tokens = useTokens();
  const t = useT();
  const isUser = message.role === "user";

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        gap: space(2),
        width: "100%",
        maxWidth: 760,
        margin: "0 auto",
        padding: `0 ${space(6)}px`,
        boxSizing: "border-box",
      }}
    >
      <span style={{ ...typeScale.micro, color: tokens.textTertiary, letterSpacing: 0.3 }}>
        {isUser ? t.roleUser : t.roleAssistant}
      </span>

      {(message.toolCalls ?? []).map((call) => (
        <ToolCard key={call.id} call={call} />
      ))}

      {message.content ? (
        <div
          style={{
            ...typeScale.body,
            color: tokens.textPrimary,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            ...(isUser
              ? {
                  background: tokens.cardSurface,
                  borderRadius: radius.lg,
                  padding: `${space(3)}px ${space(3.5)}px`,
                }
              : {}),
          }}
        >
          {message.content}
        </div>
      ) : null}

      {pending && !message.content && (message.toolCalls ?? []).length === 0 ? (
        <span style={{ ...typeScale.body, color: tokens.textTertiary }}>{t.thinking}</span>
      ) : null}

      {message.error ? (
        <div
          style={{
            ...typeScale.caption,
            color: tokens.danger,
            background: "rgba(241, 112, 123, 0.10)",
            border: "1px solid rgba(241, 112, 123, 0.28)",
            borderRadius: radius.md,
            padding: `${space(2)}px ${space(2.5)}px`,
            wordBreak: "break-word",
          }}
        >
          {message.error}
        </div>
      ) : null}
    </article>
  );
}

function ToolCard({ call }: { call: ToolInvocation }) {
  const tokens = useTokens();
  const t = useT();
  const [open, setOpen] = useState(false);
  const done = call.result !== undefined;

  return (
    <div
      style={{
        border: `1px solid ${call.isError ? "rgba(241, 112, 123, 0.32)" : tokens.controlBorder}`,
        borderRadius: radius.md,
        background: tokens.cardSurface,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: space(1.5),
          padding: `${space(2)}px ${space(2.5)}px`,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: call.isError ? tokens.danger : tokens.textSecondary,
          ...typeScale.caption,
          textAlign: "left",
        }}
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Wrench size={13} strokeWidth={1.75} />
        <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
          {call.name}
        </code>
        <div style={{ flex: 1 }} />
        <span style={{ color: tokens.textTertiary }}>{done ? t.toolResult : `${t.toolCall}…`}</span>
      </button>

      {open ? (
        <div style={{ borderTop: `1px solid ${tokens.separator}`, padding: space(2.5) }}>
          <Pre label="arguments" value={call.arguments || "{}"} />
          {done ? <Pre label="result" value={call.result ?? ""} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function Pre({ label, value }: { label: string; value: string }) {
  const tokens = useTokens();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space(1) }}>
      <span style={{ ...typeScale.micro, color: tokens.textTertiary }}>{label}</span>
      <pre
        style={{
          ...typeScale.caption,
          margin: 0,
          marginBottom: space(2),
          padding: space(2),
          background: tokens.contentSurface,
          borderRadius: radius.sm,
          color: tokens.textSecondary,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: 260,
          overflow: "auto",
        }}
      >
        {value}
      </pre>
    </div>
  );
}
