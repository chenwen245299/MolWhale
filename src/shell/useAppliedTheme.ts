import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { isTauri } from "../tauri";
import { isDarkMode, resolveTokens, type ThemeMode, type Tokens } from "../theme";

/**
 * Push the resolved theme out to everything that lives outside React's tree.
 *
 * Three separate surfaces have to agree, or the seams show:
 *
 * 1. `color-scheme` on the root — decides how the browser paints native form
 *    controls and default scrollbars.
 * 2. CSS variables — the body ground and the styled scrollbar thumbs, which are
 *    declared in `global.css` and so cannot read from the token context.
 * 3. The Tauri window's own background colour — what macOS paints *behind* the
 *    webview. Without this, a light-mode window flashes near-black on launch
 *    and while resizing, because the native background is still the dark value
 *    baked into `tauri.conf.json`.
 *
 * This is exactly the "synchronise React state to an external system" case an
 * effect is for.
 */
export function useAppliedTheme(mode: ThemeMode, systemPrefersDark: boolean): Tokens {
  const tokens = resolveTokens(mode, systemPrefersDark);
  const dark = isDarkMode(mode, systemPrefersDark);

  useEffect(() => {
    const root = document.documentElement;
    root.style.colorScheme = dark ? "dark" : "light";
    root.style.setProperty("--mw-window-base", tokens.windowBase);
    root.style.setProperty("--mw-scroll-thumb", tokens.scrollThumb);
    root.style.setProperty(
      "--mw-scroll-thumb-hover",
      dark ? "rgba(255, 255, 255, 0.26)" : "rgba(15, 18, 24, 0.30)",
    );
  }, [dark, tokens.windowBase, tokens.scrollThumb]);

  useEffect(() => {
    if (!isTauri()) return;
    // Best-effort: an older Tauri or a platform without the permission simply
    // keeps the configured colour, which is cosmetic rather than functional.
    void getCurrentWindow()
      .setBackgroundColor(tokens.windowBase)
      .catch(() => {});
  }, [tokens.windowBase]);

  return tokens;
}
