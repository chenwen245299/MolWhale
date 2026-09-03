import { LayoutDashboard } from "lucide-react";

import { useT } from "../i18n";
import { space, type as typeScale, useTokens } from "../theme";
import type { PanelContext } from "./registry";

/**
 * What sits in a right-hand slot until a real panel claims it.
 *
 * It deliberately shows the current project/conversation ids: that makes the
 * wiring visible while the slots are empty, so whoever fills one in can see the
 * context it will receive.
 */
export function PlaceholderPanel({
  slot,
  context,
}: {
  slot: "top" | "bottom";
  context: PanelContext;
}) {
  const tokens = useTokens();
  const t = useT();

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: space(2),
        padding: space(4),
        textAlign: "center",
        minHeight: 0,
      }}
    >
      <LayoutDashboard size={22} color={tokens.textTertiary} strokeWidth={1.5} />
      <span style={{ ...typeScale.label, color: tokens.textSecondary }}>{t.panelPlaceholder}</span>
      <span
        style={{
          ...typeScale.caption,
          color: tokens.textTertiary,
          lineHeight: 1.6,
          maxWidth: 260,
        }}
      >
        {t.panelPlaceholderBody}
      </span>
      <code
        style={{
          ...typeScale.micro,
          color: tokens.textTertiary,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          opacity: 0.75,
          wordBreak: "break-all",
        }}
      >
        slot={slot} · {context.projectId ?? "—"}/{context.conversationId ?? "—"}
      </code>
    </div>
  );
}
