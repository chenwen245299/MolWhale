import type { ReactNode } from "react";
import { useState } from "react";
import { Plus } from "lucide-react";

import { IconButton } from "../components/ui";
import { radius, space, type as typeScale, useTokens } from "../theme";

/**
 * The list-and-detail chrome shared by the providers and MCP settings panes.
 *
 * Both are the same shape — a narrow column of configured things on the left, a
 * form for the selected one on the right — so the chrome lives here once and
 * the two panes supply only their rows and their detail form.
 */

export function ListDetail({ list, detail }: { list: ReactNode; detail: ReactNode }) {
  const tokens = useTokens();
  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, minWidth: 0 }}>
      <div
        style={{
          width: 232,
          flex: "0 0 auto",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          borderRight: `1px solid ${tokens.separator}`,
        }}
      >
        {list}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {detail}
      </div>
    </div>
  );
}

export function ListColumn({
  title,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  onAdd: () => void;
  addLabel: string;
  children: ReactNode;
}) {
  const tokens = useTokens();
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: space(1),
          padding: `${space(3)}px ${space(2)}px ${space(1.5)}px ${space(3)}px`,
          flex: "0 0 auto",
        }}
      >
        <span style={{ ...typeScale.label, color: tokens.textSecondary, flex: 1 }}>{title}</span>
        <IconButton title={addLabel} onClick={onAdd} size={24}>
          <Plus size={15} strokeWidth={2} />
        </IconButton>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: `0 ${space(2)}px ${space(2)}px` }}>
        {children}
      </div>
    </>
  );
}

/**
 * One row in a list column: icon, name, and a trailing control (usually a
 * toggle). Right-click surfaces the row's context menu, which is where delete
 * lives — matching Nomi, and keeping a destructive action off the primary row.
 */
export function ListRow({
  icon,
  label,
  muted,
  active,
  onSelect,
  onContextMenu,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  muted?: boolean;
  active: boolean;
  onSelect: () => void;
  onContextMenu?: (x: number, y: number) => void;
  trailing?: ReactNode;
}) {
  const tokens = useTokens();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={(event) => {
        if (!onContextMenu) return;
        event.preventDefault();
        onContextMenu(event.clientX, event.clientY);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: space(2),
        padding: `${space(1.5)}px ${space(2)}px`,
        marginBottom: 2,
        borderRadius: radius.md,
        cursor: "pointer",
        background: active ? tokens.selection : hovered ? tokens.controlHover : "transparent",
        transition: "background 100ms ease",
      }}
    >
      {icon}
      <span
        style={{
          ...typeScale.label,
          flex: 1,
          minWidth: 0,
          color: muted ? tokens.textTertiary : tokens.textPrimary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {trailing}
    </div>
  );
}

/** Header strip above a detail form: icon, title, and trailing actions. */
export function DetailHeader({
  icon,
  title,
  actions,
}: {
  icon?: ReactNode;
  title: string;
  actions?: ReactNode;
}) {
  const tokens = useTokens();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: space(2),
        // Extra right padding clears the modal's floating close button, which
        // sits at the same height as these actions.
        padding: `${space(3)}px ${space(12)}px ${space(3)}px ${space(4)}px`,
        borderBottom: `1px solid ${tokens.separator}`,
        flex: "0 0 auto",
      }}
    >
      {icon}
      <span style={{ ...typeScale.h2, color: tokens.textPrimary, flex: 1, minWidth: 0 }}>
        {title}
      </span>
      {actions}
    </div>
  );
}

/** Scrolling body of a detail form. */
export function DetailBody({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: space(4),
        display: "flex",
        flexDirection: "column",
        gap: space(4),
      }}
    >
      {children}
    </div>
  );
}

export function EmptyDetail({ title, body }: { title: string; body: string }) {
  const tokens = useTokens();
  return (
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
      <span style={{ ...typeScale.h2, color: tokens.textPrimary }}>{title}</span>
      <span
        style={{ ...typeScale.body, color: tokens.textTertiary, maxWidth: 320, lineHeight: 1.7 }}
      >
        {body}
      </span>
    </div>
  );
}

/** Right-click menu for a list row. Closes on any outside click or Escape. */
export function ContextMenu({
  x,
  y,
  onClose,
  items,
}: {
  x: number;
  y: number;
  onClose: () => void;
  items: { label: string; danger?: boolean; onSelect: () => void }[];
}) {
  const tokens = useTokens();
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
      style={{ position: "fixed", inset: 0, zIndex: 200 }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "fixed",
          // Nudged off the cursor so the first item is not already hovered.
          left: Math.min(x + 2, window.innerWidth - 180),
          top: Math.min(y + 2, window.innerHeight - items.length * 32 - 12),
          minWidth: 160,
          padding: space(1),
          borderRadius: radius.md,
          background: tokens.overlaySurface,
          border: `1px solid ${tokens.separatorStrong}`,
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
        }}
      >
        {items.map((item, index) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              item.onSelect();
              onClose();
            }}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            style={{
              ...typeScale.label,
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: `${space(1.5)}px ${space(2)}px`,
              borderRadius: radius.sm,
              border: "none",
              cursor: "pointer",
              background: hovered === index ? tokens.controlHover : "transparent",
              color: item.danger ? tokens.danger : tokens.textPrimary,
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Claude Code-style form primitives: a section heading, then rows whose label
 * sits left and control right, separated by hairlines.
 *
 * The stacked "label above input" shape reads better for long free-text fields,
 * so `SettingsRow` takes a `stacked` flag rather than forcing every field into
 * one line — a six-row textarea squeezed into the right half of a row is worse
 * than an honest full-width one.
 */
export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const tokens = useTokens();
  return (
    <section style={{ display: "flex", flexDirection: "column" }}>
      <h2
        style={{
          ...typeScale.h1,
          color: tokens.textPrimary,
          margin: 0,
          marginBottom: space(3),
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function SettingsRow({
  label,
  description,
  stacked,
  children,
}: {
  label: string;
  description?: string;
  stacked?: boolean;
  children: ReactNode;
}) {
  const tokens = useTokens();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: stacked ? "column" : "row",
        alignItems: stacked ? "stretch" : "center",
        gap: stacked ? space(2) : space(4),
        padding: `${space(3.5)}px 0`,
        borderBottom: `1px solid ${tokens.separator}`,
      }}
    >
      <div style={{ flex: stacked ? undefined : 1, minWidth: 0 }}>
        <div style={{ ...typeScale.body, color: tokens.textPrimary }}>{label}</div>
        {description ? (
          <div
            style={{
              ...typeScale.caption,
              color: tokens.textTertiary,
              marginTop: space(0.75),
              lineHeight: 1.6,
            }}
          >
            {description}
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: space(2),
          ...(stacked ? {} : { flex: "0 0 auto", maxWidth: "52%" }),
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Scrolling body for a row-based settings page. */
export function SettingsPage({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: `${space(6)}px ${space(7)}px ${space(7)}px`,
        display: "flex",
        flexDirection: "column",
        gap: space(7),
      }}
    >
      {children}
    </div>
  );
}
