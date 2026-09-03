import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Settings,
  Workflow,
} from "lucide-react";

import { useT } from "../i18n";
import type { Conversation, Project } from "../projects/api";
import { IconButton, TextField } from "../components/ui";
import {
  RAIL_GUTTER,
  SHELL_HEADER_HEIGHT,
  radius,
  space,
  type as typeScale,
  useTokens,
} from "../theme";

/**
 * Projects, the conversations inside them, and the rail's own navigation.
 *
 * The structural rule the app is built around shows up here: "new conversation"
 * is disabled unless a project is selected, because a conversation has nowhere
 * to live otherwise — it is a directory inside a project directory. Creating a
 * *project*, by contrast, hangs off the section header, so the two actions read
 * at the level they actually operate on.
 */

export type SidebarView = "chat" | "workflows";

export interface LeftSidebarProps {
  projects: Project[];
  conversationsByProject: Record<string, Conversation[]>;
  expanded: Record<string, boolean>;
  selectedProjectId: string | null;
  selectedConversationId: string | null;
  view: SidebarView;
  onToggleProject: (projectId: string) => void;
  onSelectProject: (projectId: string) => void;
  onSelectConversation: (projectId: string, conversationId: string) => void;
  onCreateProject: (name: string) => void;
  onCreateConversation: () => void;
  onDeleteProject: (project: Project) => void;
  onDeleteConversation: (conversation: Conversation) => void;
  onSelectView: (view: SidebarView) => void;
  onOpenSettings: () => void;
  onCollapse: () => void;
}

/** A full-width, icon-plus-label row — the rail's primary control shape. */
function NavRow({
  icon,
  label,
  active,
  disabled,
  title,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  const tokens = useTokens();
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...typeScale.label,
        display: "flex",
        alignItems: "center",
        gap: space(2),
        width: "100%",
        textAlign: "left",
        height: 30,
        padding: `0 ${space(2)}px`,
        marginBottom: 1,
        borderRadius: radius.md,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        background: active
          ? tokens.selection
          : hovered && !disabled
            ? tokens.controlHover
            : "transparent",
        color: active ? tokens.textPrimary : tokens.textSecondary,
        transition: "background 100ms ease, color 100ms ease",
      }}
    >
      <span style={{ display: "flex", flex: "0 0 auto" }}>{icon}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
    </button>
  );
}

function Row({
  children,
  depth = 0,
  selected,
  onClick,
  trailing,
}: {
  children: ReactNode;
  depth?: number;
  selected?: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  const tokens = useTokens();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: space(1),
        height: 30,
        paddingLeft: space(2) + depth * 14,
        paddingRight: space(1),
        marginBottom: 1,
        borderRadius: radius.md,
        cursor: "pointer",
        background: selected ? tokens.selection : hovered ? tokens.controlHover : "transparent",
        color: selected ? tokens.textPrimary : tokens.textSecondary,
        transition: "background 100ms ease",
      }}
    >
      {children}
      <div style={{ flex: 1 }} />
      {hovered || selected ? trailing : null}
    </div>
  );
}

export function LeftSidebar(props: LeftSidebarProps) {
  const tokens = useTokens();
  const t = useT();
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");

  const submitProject = () => {
    const name = draftName.trim();
    if (name) props.onCreateProject(name);
    setDraftName("");
    setCreating(false);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: tokens.railSurface,
        minWidth: 0,
      }}
    >
      {/* The traffic lights are overlaid on this strip, so it starts inset past
          them. "deep" makes the whole strip draggable; Tauri excludes the
          buttons from it automatically. */}
      <div
        data-tauri-drag-region="deep"
        style={{
          height: SHELL_HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          paddingLeft: 78,
          paddingRight: space(1.5),
          flex: "0 0 auto",
        }}
      >
        <IconButton title={t.collapseSidebar} onClick={props.onCollapse}>
          <PanelLeft size={16} strokeWidth={1.75} />
        </IconButton>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: `0 ${space(1.5)}px` }}>
        <NavRow
          icon={<Plus size={16} strokeWidth={2} />}
          label={t.newChat}
          disabled={!props.selectedProjectId}
          title={props.selectedProjectId ? t.newConversation : t.newConversationNeedsProject}
          onClick={props.onCreateConversation}
        />
        <NavRow
          icon={<Workflow size={16} strokeWidth={1.75} />}
          label={t.workflows}
          active={props.view === "workflows"}
          onClick={() => props.onSelectView("workflows")}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: space(1),
            padding: `${space(3)}px ${space(1)}px ${space(1)}px ${space(2)}px`,
          }}
        >
          <span
            style={{
              ...typeScale.micro,
              color: tokens.textTertiary,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              flex: 1,
            }}
          >
            {t.projects}
          </span>
          <IconButton size={22} title={t.newProject} onClick={() => setCreating(true)}>
            <Plus size={14} strokeWidth={2} />
          </IconButton>
        </div>

        {creating ? (
          <div style={{ padding: `${space(0.5)}px ${space(1)}px ${space(2)}px` }}>
            <TextField
              autoFocus
              value={draftName}
              onChange={setDraftName}
              onSubmit={submitProject}
              placeholder={t.newProject}
            />
          </div>
        ) : null}

        {props.projects.length === 0 && !creating ? (
          <div
            style={{
              ...typeScale.caption,
              color: tokens.textTertiary,
              padding: `${space(1)}px ${RAIL_GUTTER}px`,
            }}
          >
            {t.noProjects}
          </div>
        ) : null}

        {props.projects.map((project) => {
          const isOpen = props.expanded[project.id] ?? false;
          const conversations = props.conversationsByProject[project.id] ?? [];
          const isSelected = props.selectedProjectId === project.id;

          return (
            <div key={project.id}>
              <Row
                selected={props.view === "chat" && isSelected && !props.selectedConversationId}
                onClick={() => {
                  props.onSelectProject(project.id);
                  props.onToggleProject(project.id);
                }}
                trailing={
                  <IconButton
                    size={22}
                    title={t.deleteProject}
                    onClick={() => props.onDeleteProject(project)}
                  >
                    <MoreHorizontal size={14} strokeWidth={1.75} />
                  </IconButton>
                }
              >
                {isOpen ? (
                  <ChevronDown size={14} strokeWidth={2} style={{ flex: "0 0 auto" }} />
                ) : (
                  <ChevronRight size={14} strokeWidth={2} style={{ flex: "0 0 auto" }} />
                )}
                <span
                  style={{
                    ...typeScale.label,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {project.name}
                </span>
              </Row>

              {isOpen
                ? conversations.map((conversation) => (
                    <Row
                      key={conversation.id}
                      depth={1}
                      selected={
                        props.view === "chat" && props.selectedConversationId === conversation.id
                      }
                      onClick={() => props.onSelectConversation(project.id, conversation.id)}
                      trailing={
                        <IconButton
                          size={22}
                          title={t.delete}
                          onClick={() => props.onDeleteConversation(conversation)}
                        >
                          <MoreHorizontal size={14} strokeWidth={1.75} />
                        </IconButton>
                      }
                    >
                      <span
                        style={{
                          ...typeScale.body,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {conversation.title}
                      </span>
                    </Row>
                  ))
                : null}

              {isOpen && conversations.length === 0 ? (
                <div
                  style={{
                    ...typeScale.caption,
                    color: tokens.textTertiary,
                    padding: `${space(1)}px ${RAIL_GUTTER + 14}px ${space(2)}px`,
                  }}
                >
                  {t.noConversations}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div
        style={{
          flex: "0 0 auto",
          borderTop: `1px solid ${tokens.separator}`,
          padding: space(1.5),
        }}
      >
        <NavRow
          icon={<Settings size={16} strokeWidth={1.75} />}
          label={t.settings}
          onClick={props.onOpenSettings}
        />
      </div>
    </div>
  );
}
