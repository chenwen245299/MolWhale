import { useEffect, useState } from "react";
import { Info, Plug, Settings2, Sparkles, X } from "lucide-react";

import { useT } from "../i18n";
import { IconButton } from "../components/ui";
import { McpSettings } from "../mcp/McpSettings";
import type { McpServerConfig } from "../mcp/api";
import { ProvidersSettings } from "../providers/ProvidersSettings";
import type { ProviderInfo } from "../providers/api";
import type { StorageStatus } from "../projects/api";
import { radius, space, type as typeScale, useTokens } from "../theme";
import { AboutSettings } from "./AboutSettings";
import { GeneralSettings } from "./GeneralSettings";
import type { AppSettings } from "./api";

type Section = "general" | "providers" | "mcp" | "about";

/**
 * Settings, shaped like Claude Code's: one standalone modal, a grouped nav rail
 * down the left, and the chosen page filling the rest.
 *
 * The pages are not all the same shape on purpose. General and About are
 * row-based forms (label left, control right); providers and MCP are
 * list-and-detail, because they hold collections you switch between rather than
 * a fixed set of fields.
 */
export function SettingsModal({
  open,
  onClose,
  settings,
  onSettingsChange,
  providers,
  reloadProviders,
  mcpServers,
  reloadMcpServers,
  storage,
  onChangeFolder,
}: {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  providers: ProviderInfo[];
  reloadProviders: () => Promise<void> | void;
  mcpServers: McpServerConfig[];
  reloadMcpServers: () => Promise<void> | void;
  storage: StorageStatus | null;
  onChangeFolder: () => void;
}) {
  const tokens = useTokens();
  const t = useT();
  const [section, setSection] = useState<Section>("general");

  // Escape closes, the way every settings dialog on the platform does.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const groups: {
    title: string;
    items: { id: Section; label: string; icon: typeof Settings2 }[];
  }[] = [
    {
      title: t.navGroupSettings,
      items: [
        { id: "general", label: t.tabGeneral, icon: Settings2 },
        { id: "providers", label: t.tabProviders, icon: Sparkles },
        { id: "mcp", label: t.tabMcp, icon: Plug },
      ],
    },
    {
      title: t.navGroupAbout,
      items: [{ id: "about", label: t.tabAbout, icon: Info }],
    },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: tokens.scrim,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(1040px, 94vw)",
          height: "min(700px, 90vh)",
          background: tokens.overlaySurface,
          borderRadius: radius.xl,
          border: `1px solid ${tokens.separatorStrong}`,
          display: "flex",
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0, 0, 0, 0.55)",
        }}
      >
        <nav
          style={{
            width: 216,
            flex: "0 0 auto",
            background: tokens.railSurface,
            borderRight: `1px solid ${tokens.separator}`,
            display: "flex",
            flexDirection: "column",
            padding: space(2),
            overflowY: "auto",
          }}
        >
          {groups.map((group) => (
            <div key={group.title} style={{ marginBottom: space(3) }}>
              <div
                style={{
                  ...typeScale.caption,
                  color: tokens.textTertiary,
                  padding: `${space(2)}px ${space(2)}px ${space(1)}px`,
                }}
              >
                {group.title}
              </div>
              {group.items.map((item) => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  active={section === item.id}
                  onSelect={() => setSection(item.id)}
                />
              ))}
            </div>
          ))}
        </nav>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", top: space(3), right: space(3), zIndex: 10 }}>
            <IconButton title={t.close} onClick={onClose}>
              <X size={16} strokeWidth={2} />
            </IconButton>
          </div>

          {section === "general" ? (
            <GeneralSettings
              settings={settings}
              onSettingsChange={onSettingsChange}
              storage={storage}
              onChangeFolder={onChangeFolder}
            />
          ) : null}

          {section === "providers" ? (
            <ProvidersSettings providers={providers} onReload={reloadProviders} />
          ) : null}

          {section === "mcp" ? (
            <McpSettings servers={mcpServers} onReload={reloadMcpServers} />
          ) : null}

          {section === "about" ? <AboutSettings storage={storage} /> : null}
        </div>
      </div>
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  onSelect,
}: {
  icon: typeof Settings2;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  const tokens = useTokens();
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...typeScale.label,
        display: "flex",
        alignItems: "center",
        gap: space(2),
        width: "100%",
        textAlign: "left",
        padding: `${space(1.75)}px ${space(2)}px`,
        marginBottom: 2,
        borderRadius: radius.md,
        border: "none",
        cursor: "pointer",
        background: active ? tokens.selection : hovered ? tokens.controlHover : "transparent",
        color: active ? tokens.textPrimary : tokens.textSecondary,
        transition: "background 100ms ease, color 100ms ease",
      }}
    >
      <Icon size={16} strokeWidth={1.75} style={{ flex: "0 0 auto" }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
    </button>
  );
}
