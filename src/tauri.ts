import { invoke as tauriInvoke } from "@tauri-apps/api/core";

/**
 * Whether we are running inside the Tauri webview or a plain browser.
 *
 * `pnpm dev` in a browser is the fastest way to iterate on layout, so every
 * `api.ts` in this app falls back to in-memory fixtures when this is false.
 * Without that, the whole UI is a wall of IPC errors outside the desktop shell.
 */
export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const invoke = tauriInvoke;

/** Errors cross the IPC boundary as plain strings; normalise them for display. */
export function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
}
