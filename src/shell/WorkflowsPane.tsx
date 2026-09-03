import { PanelLeft, Workflow } from "lucide-react";

import { useT } from "../i18n";
import { IconButton } from "../components/ui";
import {
  collapseTransition,
  SHELL_HEADER_HEIGHT,
  space,
  type as typeScale,
  useTokens,
} from "../theme";

/**
 * The Workflows destination — reserved, not yet built.
 *
 * It renders its own titlebar for the same reason `ChatHeader` does: that strip
 * is the window's drag handle, and a view that omitted it would leave a dead
 * band across the top of the window.
 */
export function WorkflowsPane({
  sidebarCollapsed,
  onExpandSidebar,
}: {
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
}) {
  const tokens = useTokens();
  const t = useT();

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
      <header
        data-tauri-drag-region="deep"
        style={{
          height: SHELL_HEADER_HEIGHT,
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          gap: space(1.5),
          // With the rail hidden this header owns the traffic-light corner.
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

        <Workflow size={14} strokeWidth={1.75} color={tokens.textTertiary} />
        <span style={{ ...typeScale.label, color: tokens.textPrimary }}>{t.workflows}</span>
      </header>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: space(2),
          padding: space(6),
          textAlign: "center",
        }}
      >
        <Workflow size={26} strokeWidth={1.25} color={tokens.textTertiary} />
        <span style={{ ...typeScale.h2, color: tokens.textPrimary }}>{t.workflowsPlaceholder}</span>
        <span
          style={{
            ...typeScale.body,
            color: tokens.textTertiary,
            maxWidth: 420,
            lineHeight: 1.7,
          }}
        >
          {t.workflowsPlaceholderBody}
        </span>
      </div>
    </div>
  );
}
