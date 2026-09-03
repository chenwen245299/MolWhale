import { useI18n, useT, LOCALES, type Locale } from "../i18n";
import { Button, Select, TextArea, TextField } from "../components/ui";
import type { StorageStatus } from "../projects/api";
import { type as typeScale, useTokens } from "../theme";
import { SettingsPage, SettingsRow, SettingsSection } from "./layout";
import { setSettings, type AppSettings } from "./api";

export function GeneralSettings({
  settings,
  onSettingsChange,
  storage,
  onChangeFolder,
}: {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  storage: StorageStatus | null;
  onChangeFolder: () => void;
}) {
  const tokens = useTokens();
  const t = useT();
  const { setLocale } = useI18n();

  const persist = async (next: AppSettings) => {
    onSettingsChange(next);
    // The locale lives in two places on purpose: the config file so it survives
    // a restart, and i18n context so the UI updates without a reload.
    setLocale(next.locale);
    try {
      await setSettings(next);
    } catch {
      // A settings write that fails should not strand the UI on a value the
      // user cannot see; the next save retries.
    }
  };

  return (
    <SettingsPage>
      <SettingsSection title={t.tabGeneral}>
        <SettingsRow label={t.language}>
          <div style={{ width: 200 }}>
            <Select<Locale>
              value={settings.locale}
              onChange={(locale) => void persist({ ...settings, locale })}
              options={LOCALES.map((entry) => ({ value: entry.id, label: entry.label }))}
            />
          </div>
        </SettingsRow>

        <SettingsRow label={t.appearance} description={t.appearanceDarkHint}>
          <span style={{ ...typeScale.body, color: tokens.textTertiary }}>{t.appearanceDark}</span>
        </SettingsRow>

        <SettingsRow label={t.workspaceFolder} description={storage?.rootPath ?? undefined}>
          <Button onClick={onChangeFolder}>{t.changeFolder}</Button>
        </SettingsRow>

        <SettingsRow label={t.maxToolRounds} description={t.maxToolRoundsHint}>
          <div style={{ width: 96 }}>
            <TextField
              value={String(settings.maxToolRounds)}
              onChange={(value) => {
                const parsed = Number.parseInt(value, 10);
                void persist({
                  ...settings,
                  maxToolRounds: Number.isFinite(parsed) ? Math.max(1, Math.min(30, parsed)) : 1,
                });
              }}
            />
          </div>
        </SettingsRow>

        {/* Stacked: a system prompt needs the full width to be editable at all. */}
        <SettingsRow stacked label={t.systemPrompt}>
          <div style={{ width: "100%" }}>
            <TextArea
              rows={6}
              value={settings.systemPrompt}
              onChange={(systemPrompt) => void persist({ ...settings, systemPrompt })}
              placeholder={t.systemPromptPlaceholder}
            />
          </div>
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  );
}
