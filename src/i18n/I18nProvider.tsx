import { useMemo, useState, type ReactNode } from "react";

import { en } from "./en";
import { zhCN, type Strings } from "./zh-CN";
import { I18nContext, type Locale } from "./context";

const TABLES: Record<Locale, Strings> = {
  "zh-CN": zhCN,
  en,
};

export function I18nProvider({
  initialLocale = "zh-CN",
  children,
}: {
  initialLocale?: Locale;
  children: ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const value = useMemo(() => ({ locale, setLocale, t: TABLES[locale] ?? zhCN }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
