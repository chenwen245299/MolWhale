import { invoke, isTauri } from "../tauri";
import type { Locale } from "../i18n";
import type { ThemeMode } from "../theme";

export interface AppSettings {
  locale: Locale;
  theme: ThemeMode;
  maxToolRounds: number;
  systemPrompt: string;
}

const preview: { settings: AppSettings } = {
  settings: { locale: "zh-CN", theme: "system", maxToolRounds: 8, systemPrompt: "" },
};

export async function getSettings(): Promise<AppSettings> {
  if (isTauri()) return invoke<AppSettings>("get_settings");
  return { ...preview.settings };
}

export async function setSettings(settings: AppSettings): Promise<AppSettings> {
  if (isTauri()) return invoke<AppSettings>("set_settings", { settings });
  preview.settings = { ...settings };
  return { ...preview.settings };
}
