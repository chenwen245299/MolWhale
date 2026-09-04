import { createContext, useContext, useSyncExternalStore } from "react";

// ── MolWhale design system ──────────────────────────────────────────────────
// Quiet and Codex-adjacent. Depth reads from value alone — each surface sits a
// step above the one behind it — so the app needs almost no borders. Accent is
// a teal that marks selection and the send affordance, never body text.
//
// Both palettes fill the same `Tokens` shape, and every colour in the app comes
// from it, so switching themes is one provider value and nothing else.

export const SHELL_HEADER_HEIGHT = 44;

/**
 * Whether the user asked the OS to cut animation.
 *
 * Read once at module load: it is a system preference, not something that
 * changes while a window is open, and re-reading it per render would cost a
 * layout query on every paint.
 */
export const reduceMotion =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The sidebar collapse timing.
 *
 * 220ms with a decelerating curve: long enough to read as one motion rather
 * than a jump, short enough that toggling twice in a row does not feel like
 * waiting on the UI.
 */
export const COLLAPSE_MS = reduceMotion ? 0 : 220;
export const COLLAPSE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
export const collapseTransition = (...properties: string[]) =>
  properties.map((property) => `${property} ${COLLAPSE_MS}ms ${COLLAPSE_EASE}`).join(", ");
export const RAIL_GUTTER = 10;

export interface Tokens {
  // Surfaces, dark → light
  windowBase: string;
  railSurface: string;
  contentSurface: string;
  cardSurface: string;
  overlaySurface: string;
  scrim: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  onAccent: string;

  // Lines
  separator: string;
  separatorStrong: string;

  // Controls
  controlIdle: string;
  controlHover: string;
  controlPressed: string;
  controlBorder: string;
  inputFill: string;

  // Accent + status
  accent: string;
  accentMuted: string;
  selection: string;
  danger: string;
  success: string;
  warning: string;

  // Misc
  scrollThumb: string;
  handleIdle: string;
  handleActive: string;
}

export const darkTokens: Tokens = {
  windowBase: "#141416",
  railSurface: "#191A1C",
  contentSurface: "#1B1B1D",
  cardSurface: "#232326",
  overlaySurface: "#252528",
  scrim: "rgba(0, 0, 0, 0.55)",

  textPrimary: "#EDEDEF",
  textSecondary: "#A3A3AA",
  textTertiary: "#6E6E77",
  onAccent: "#08201D",

  separator: "rgba(255, 255, 255, 0.07)",
  separatorStrong: "rgba(255, 255, 255, 0.13)",

  controlIdle: "rgba(255, 255, 255, 0.04)",
  controlHover: "rgba(255, 255, 255, 0.08)",
  controlPressed: "rgba(255, 255, 255, 0.12)",
  controlBorder: "rgba(255, 255, 255, 0.10)",
  inputFill: "#212124",

  accent: "#4FD1B8",
  accentMuted: "rgba(79, 209, 184, 0.16)",
  selection: "rgba(255, 255, 255, 0.09)",
  danger: "#F1707B",
  success: "#5FCF8E",
  warning: "#E2B65C",

  scrollThumb: "rgba(255, 255, 255, 0.16)",
  handleIdle: "transparent",
  handleActive: "rgba(79, 209, 184, 0.45)",
};

/**
 * The light palette.
 *
 * Not a mechanical inversion. The rail is a step *darker* than content here
 * (content is the white page, chrome recedes around it), which is the opposite
 * ordering to dark mode where the rail is lighter than the window — in both
 * cases the content surface is the one that stands forward. The accent also
 * darkens: #4FD1B8 carries the right weight on near-black but fails contrast as
 * a fill behind white text, so light mode uses a deeper teal.
 */
export const lightTokens: Tokens = {
  windowBase: "#E9EBEF",
  railSurface: "#F1F2F5",
  contentSurface: "#FFFFFF",
  cardSurface: "#F5F6F8",
  overlaySurface: "#FFFFFF",
  scrim: "rgba(15, 18, 24, 0.28)",

  textPrimary: "#15171B",
  textSecondary: "#565B64",
  textTertiary: "#878D97",
  onAccent: "#FFFFFF",

  separator: "rgba(15, 18, 24, 0.09)",
  separatorStrong: "rgba(15, 18, 24, 0.16)",

  controlIdle: "rgba(15, 18, 24, 0.04)",
  controlHover: "rgba(15, 18, 24, 0.07)",
  controlPressed: "rgba(15, 18, 24, 0.11)",
  controlBorder: "rgba(15, 18, 24, 0.13)",
  inputFill: "#FFFFFF",

  accent: "#0E9B82",
  accentMuted: "rgba(14, 155, 130, 0.13)",
  selection: "rgba(15, 18, 24, 0.07)",
  danger: "#C8323E",
  success: "#1B8A52",
  warning: "#9A6C15",

  scrollThumb: "rgba(15, 18, 24, 0.20)",
  handleIdle: "transparent",
  handleActive: "rgba(14, 155, 130, 0.45)",
};

export type ThemeMode = "light" | "dark" | "system";

const darkQuery = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

// Hoisted so their identity is stable: `useSyncExternalStore` resubscribes
// whenever `subscribe` changes, and an inline closure would tear down and
// re-add the media-query listener on every single render.
function subscribeToSystemTheme(onChange: () => void): () => void {
  const query = darkQuery();
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

function getSystemPrefersDark(): boolean {
  return darkQuery()?.matches ?? true;
}

// Server/prerender has no media query; dark matches the app's own default.
const getSystemPrefersDarkServer = () => true;

/**
 * Whether the OS is currently in dark mode, as a live subscription.
 *
 * `useSyncExternalStore` rather than an effect: the media query *is* an
 * external store, and this way there is no render-then-correct flash when the
 * system flips, and no setState inside an effect.
 */
export function useSystemPrefersDark(): boolean {
  return useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemPrefersDark,
    getSystemPrefersDarkServer,
  );
}

export function resolveTokens(mode: ThemeMode, systemPrefersDark: boolean): Tokens {
  if (mode === "system") return systemPrefersDark ? darkTokens : lightTokens;
  return mode === "dark" ? darkTokens : lightTokens;
}

export function isDarkMode(mode: ThemeMode, systemPrefersDark: boolean): boolean {
  return mode === "system" ? systemPrefersDark : mode === "dark";
}

/** Type scale. Sizes are in px; RNW maps them straight through. */
export const type = {
  h1: { fontSize: 22, fontWeight: "600" as const },
  h2: { fontSize: 16, fontWeight: "600" as const },
  body: { fontSize: 14, fontWeight: "400" as const },
  label: { fontSize: 13, fontWeight: "500" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
  micro: { fontSize: 11, fontWeight: "500" as const },
};

export const radius = { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 };

export const space = (n: number) => n * 4;

const ThemeContext = createContext<Tokens>(darkTokens);

export const ThemeProvider = ThemeContext.Provider;

export function useTokens(): Tokens {
  return useContext(ThemeContext);
}
