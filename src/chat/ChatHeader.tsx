import { Folder, MessageSquare, PanelLeft } from "lucide-react";

import { useT } from "../i18n";
import { IconButton } from "../components/ui";
import type { Conversation, Project } from "../projects/api";
import type { ProviderInfo } from "../providers/api";
import {
  collapseTransition,
  SHELL_HEADER_HEIGHT,
  space,
  type as typeScale,
  useTokens,
} from "../theme";
import { ModelPicker } from "./ModelPicker";

/**
 * The centre column's titlebar.
 *
 * It renders in every state — including "no conversation selected" — because it
 * is also the window's drag handle for this third of the titlebar strip. A
 * header that disappeared with the conversation would leave a dead strip the
 * user cannot grab.
 *
 * `data-tauri-drag-region="deep"` makes the whole strip draggable rather than
 * just the gaps between its children (a bare `data-tauri-drag-region` only
 * fires on direct hits, so the title text would block the drag). Tauri excludes
 * clickable elements from a deep region on its own, so the model picker inside
 * still opens normally.
 */
export function ChatHeader({
  project,
  conversation,
  providers,
  providerId,
  model,
  sidebarCollapsed,
  onExpandSidebar,
  onModelChange,
}: {
  project: Project | null;
  conversation: Conversation | null;
  providers: ProviderInfo[];
  providerId: string | null;
  model: string | null;
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  onModelChange: (providerId: string, model: string) => void;
}) {
  const tokens = useTokens();
  const t = useT();

  const title = conversation?.title ?? project?.name ?? t.appName;
  const Icon = conversation ? MessageSquare : Folder;

  return (
    <header
      data-tauri-drag-region="deep"
      style={{
        height: SHELL_HEADER_HEIGHT,
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        gap: space(1.5),
        // With the rail hidden this header owns the traffic-light corner, so it
        // has to inset past them or the expand button lands under the buttons.
        paddingLeft: sidebarCollapsed ? 78 : space(3),
        transition: collapseTransition("padding-left"),
        paddingRight: space(3),
        borderBottom: `1px solid ${tokens.separator}`,
      }}
    >
      {sidebarCollapsed ? (
        <span className="mw-fade-in" style={{ display: "flex" }}>
          <IconButton title={t.expandSidebar} onClick={onExpandSidebar}>
            <PanelLeft size={16} strokeWidth={1.75} />
          </IconButton>
        </span>
      ) : null}

      <Icon size={14} strokeWidth={1.75} color={tokens.textTertiary} style={{ flex: "0 0 auto" }} />
      <span
        style={{
          ...typeScale.label,
          color: conversation || project ? tokens.textPrimary : tokens.textTertiary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </span>

      {conversation && project ? (
        <span
          style={{
            ...typeScale.caption,
            color: tokens.textTertiary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: "0 1 auto",
          }}
        >
          · {project.name}
        </span>
      ) : null}

      <div style={{ flex: 1 }} />

      {conversation ? (
        <ModelPicker
          providers={providers}
          providerId={providerId}
          model={model}
          onChange={onModelChange}
        />
      ) : null}
    </header>
  );
}
