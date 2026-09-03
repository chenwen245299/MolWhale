import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen } from "lucide-react";

import { useT } from "../i18n";
import { Banner, Button } from "../components/ui";
import { setStorageRoot, type StorageStatus } from "../projects/api";
import { isTauri } from "../tauri";
import { radius, space, type as typeScale, useTokens } from "../theme";

/**
 * First run: nothing works until the user says where the workspace lives.
 *
 * Shown full-window rather than as a modal — there is no app behind it to look
 * at yet, and a dismissible dialog would imply the choice is optional.
 */
export function WorkspacePicker({ onReady }: { onReady: (status: StorageStatus) => void }) {
  const tokens = useTokens();
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!isTauri()) {
        // Browser preview has no native picker; a fixed path keeps the rest of
        // the UI reachable while iterating on layout.
        onReady(await setStorageRoot("/Users/you/Documents/MolWhale"));
        return;
      }
      const selected = await open({ directory: true, multiple: false, title: t.welcomeTitle });
      if (typeof selected !== "string") return;
      onReady(await setStorageRoot(selected));
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-tauri-drag-region
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: tokens.windowBase,
        padding: space(8),
      }}
    >
      <div
        style={{
          maxWidth: 460,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: space(3),
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.lg,
            background: tokens.accentMuted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FolderOpen size={24} color={tokens.accent} strokeWidth={1.5} />
        </div>

        <span style={{ ...typeScale.h1, color: tokens.textPrimary }}>{t.welcomeTitle}</span>
        <span style={{ ...typeScale.body, color: tokens.textTertiary, lineHeight: 1.7 }}>
          {t.welcomeBody}
        </span>

        {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}

        <Button variant="primary" onClick={choose} disabled={busy} style={{ marginTop: space(2) }}>
          {t.welcomeChoose}
        </Button>
      </div>
    </div>
  );
}
