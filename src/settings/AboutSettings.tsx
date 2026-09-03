import { useT } from "../i18n";
import type { StorageStatus } from "../projects/api";
import { space, type as typeScale, useTokens } from "../theme";
import { SettingsPage, SettingsRow, SettingsSection } from "./layout";

const VERSION = "0.1.0";
const STACK = "React 19 · react-native-web · Tauri 2 · Vite";

export function AboutSettings({ storage }: { storage: StorageStatus | null }) {
  const tokens = useTokens();
  const t = useT();

  const mono: React.CSSProperties = {
    ...typeScale.caption,
    color: tokens.textTertiary,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    wordBreak: "break-all",
    textAlign: "right",
  };

  return (
    <SettingsPage>
      <SettingsSection title={t.tabAbout}>
        <SettingsRow label={t.aboutVersion}>
          <span style={{ ...typeScale.body, color: tokens.textSecondary }}>{VERSION}</span>
        </SettingsRow>

        <SettingsRow label={t.aboutStack}>
          <span style={{ ...typeScale.caption, color: tokens.textTertiary, textAlign: "right" }}>
            {STACK}
          </span>
        </SettingsRow>

        <SettingsRow label={t.aboutWorkspace}>
          <code style={mono}>{storage?.rootPath ?? "—"}</code>
        </SettingsRow>

        <SettingsRow label="config.json">
          <code style={mono}>{storage?.configPath ?? "—"}</code>
        </SettingsRow>
      </SettingsSection>

      <div style={{ ...typeScale.caption, color: tokens.textTertiary, lineHeight: 1.7 }}>
        <span style={{ marginRight: space(1) }}>🐋</span>
        MolWhale
      </div>
    </SettingsPage>
  );
}
