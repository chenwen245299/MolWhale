import { useState } from "react";
import { Folder, FolderOpen } from "lucide-react";

import { useT } from "../i18n";
import { revealPath, type Conversation, type Project } from "../projects/api";
import { radius, space, type as typeScale, useTokens } from "../theme";

/**
 * The folders this conversation actually works in, shown above the composer.
 *
 * Molecular design produces files, and they land in a specific directory —
 * `<project>/conversations/<conversation>/files/`. Naming that directory where
 * the user is about to type makes the on-disk layout visible instead of
 * something they have to reconstruct from the README, and each chip opens the
 * folder so dragging a structure in is one click away.
 */
export function ContextBar({
  project,
  conversation,
}: {
  project: Project;
  conversation: Conversation;
}) {
  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        gap: space(1),
        flexWrap: "wrap",
        paddingBottom: space(1.5),
      }}
    >
      <Chip
        icon={<Folder size={13} strokeWidth={1.75} />}
        label={project.name}
        path={project.path}
      />
      <Chip
        icon={<FolderOpen size={13} strokeWidth={1.75} />}
        label="files"
        path={conversation.filesPath}
      />
    </div>
  );
}

function Chip({ icon, label, path }: { icon: React.ReactNode; label: string; path: string }) {
  const tokens = useTokens();
  const t = useT();
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      // The full path is the useful detail but far too long for the chip, so it
      // lives in the tooltip.
      title={`${path}\n${t.openFolder}`}
      onClick={() => void revealPath(path)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...typeScale.caption,
        display: "inline-flex",
        alignItems: "center",
        gap: space(1),
        maxWidth: 260,
        padding: `${space(0.75)}px ${space(1.75)}px`,
        borderRadius: radius.md,
        border: `1px solid ${hovered ? tokens.controlBorder : "transparent"}`,
        background: hovered ? tokens.controlHover : tokens.controlIdle,
        color: hovered ? tokens.textSecondary : tokens.textTertiary,
        cursor: "pointer",
        transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
      }}
    >
      <span style={{ display: "flex", flex: "0 0 auto" }}>{icon}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
    </button>
  );
}
