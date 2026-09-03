import { useMemo, useState } from "react";

import { useT } from "../i18n";
import { Banner, Empty } from "../components/ui";
import type { Conversation, Project } from "../projects/api";
import type { ProviderInfo } from "../providers/api";
import type { AppSettings } from "../settings/api";
import { useTokens } from "../theme";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { ContextBar } from "./ContextBar";
import { MessageList } from "./MessageList";
import { useChat } from "./useChat";

/**
 * The centre column: titlebar, transcript, composer.
 *
 * The titlebar renders in every state — see `ChatHeader` for why — so only the
 * body below it swaps between the empty states and a live conversation.
 *
 * The provider/model selection is per conversation, and remembered on the
 * conversation so reopening a thread does not silently switch models under the
 * user.
 *
 * App.tsx mounts this with `key={conversation.id}`, so switching threads
 * remounts it. That is what resets the composer draft and the transcript —
 * cheaper to reason about than an effect that has to remember to clear each
 * piece of per-conversation state.
 */
export function ChatPane({
  project,
  conversation,
  providers,
  settings,
  sidebarCollapsed,
  onExpandSidebar,
  onModelChange,
}: {
  project: Project | null;
  conversation: Conversation | null;
  providers: ProviderInfo[];
  settings: AppSettings;
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  onModelChange: (providerId: string, model: string) => void;
}) {
  const tokens = useTokens();
  const t = useT();
  const [draft, setDraft] = useState("");
  const chat = useChat({ conversation, providers, settings });

  // Fall back to the first provider that has both a key and a default model, so
  // a fresh conversation is immediately usable.
  const fallback = useMemo(() => {
    const candidate = providers.find(
      (provider) => provider.enabled && provider.hasKey && provider.models.length > 0,
    );
    if (!candidate) return null;
    return {
      providerId: candidate.id,
      model: candidate.defaultModel ?? candidate.models[0]?.id ?? null,
    };
  }, [providers]);

  const providerId = conversation?.providerId ?? fallback?.providerId ?? null;
  const model = conversation?.model ?? fallback?.model ?? null;

  const isEmpty = chat.messages.length === 0 && !chat.streaming;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        background: tokens.contentSurface,
      }}
    >
      <ChatHeader
        project={project}
        conversation={conversation}
        providers={providers}
        providerId={providerId}
        model={model}
        sidebarCollapsed={sidebarCollapsed}
        onExpandSidebar={onExpandSidebar}
        onModelChange={onModelChange}
      />

      {!project ? <Empty title={t.selectProjectFirst} /> : null}

      {project && !conversation ? <Empty title={t.selectConversation} /> : null}

      {project && conversation ? (
        <>
          {chat.error ? (
            <Banner message={chat.error} onDismiss={() => chat.setError(null)} />
          ) : null}

          {isEmpty ? (
            <Empty title={t.emptyChatTitle} body={t.emptyChatBody} />
          ) : (
            <MessageList
              messages={chat.messages}
              streaming={chat.streaming}
              streamingText={chat.streamingText}
              streamingToolCalls={chat.streamingToolCalls}
            />
          )}

          <Composer
            context={<ContextBar project={project} conversation={conversation} />}
            value={draft}
            onChange={setDraft}
            busy={chat.streaming}
            onStop={chat.stop}
            onSubmit={() => {
              const text = draft;
              setDraft("");
              void chat.send(text, providerId, model);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
