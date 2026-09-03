import { createContext, useContext } from "react";

import { zhCN, type Strings } from "./zh-CN";

export type Locale = "zh-CN" | "en";

export const LOCALES: { id: Locale; label: string }[] = [
  { id: "zh-CN", label: "中文" },
  { id: "en", label: "English" },
];

export interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Strings;
}

// Default to Chinese rather than sniffing navigator.language: this is a
// Chinese-first app, and a user on an English macOS still gets the UI they
// expect until they choose otherwise in settings.
export const I18nContext = createContext<I18nValue>({
  locale: "zh-CN",
  setLocale: () => {},
  t: zhCN,
});

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** Shorthand for the common case of only needing the string table. */
export function useT(): Strings {
  return useContext(I18nContext).t;
}
