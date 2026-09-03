import { createContext, useContext } from "react";

// ── MolWhale design system ──────────────────────────────────────────────────
// Dark, quiet, Codex-adjacent. The window is near-black; the two rails sit a
// step above it and content sits a step above that, so depth reads from value
// alone and the app needs almost no borders. Accent is a cool teal — it marks
// selection and the send affordance, never body text.
//
// Only a dark palette ships today. The token table is the seam where a light
// one would slot in: every colour in the app comes from `Tokens`, so a second
// table plus a provider switch is the whole job.

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
