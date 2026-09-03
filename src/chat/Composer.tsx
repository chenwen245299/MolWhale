import { useEffect, useRef } from "react";
import { ArrowUp, Square } from "lucide-react";

import { useT } from "../i18n";
import { IconButton } from "../components/ui";
import { radius, space, type as typeScale, useTokens } from "../theme";

/**
 * The input box.
 *
 * Enter sends, Shift+Enter breaks the line — the convention every chat client
 * shares, and worth matching exactly because the muscle memory is universal.
 * The textarea grows with its content up to a cap, then scrolls.
 */
const MAX_HEIGHT = 220;

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  disabled,
  trailing,
  context,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  disabled?: boolean;
  trailing?: React.ReactNode;
  /** Rendered directly above the input — see `ContextBar`. */
  context?: React.ReactNode;
}) {
  const tokens = useTokens();
  const t = useT();
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "auto";
    const needed = element.scrollHeight;
    element.style.height = `${Math.min(needed, MAX_HEIGHT)}px`;
    // Only show a scrollbar once the box has actually stopped growing —
    // otherwise the styled 10px track sits in the corner of an empty composer.
    element.style.overflowY = needed > MAX_HEIGHT ? "auto" : "hidden";
  }, [value]);

  const canSend = value.trim().length > 0 && !busy && !disabled;

  return (
    <div style={{ padding: `0 ${space(6)}px ${space(5)}px`, flex: "0 0 auto" }}>
      {context}
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          borderRadius: radius.xl,
          border: `1px solid ${tokens.controlBorder}`,
          background: tokens.cardSurface,
          padding: space(2),
          display: "flex",
          flexDirection: "column",
          gap: space(1),
        }}
      >
        <textarea
          ref={textarea}
          value={value}
          disabled={disabled}
          placeholder={t.composerPlaceholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (canSend) onSubmit();
            }
          }}
          rows={1}
          style={{
            ...typeScale.body,
            width: "100%",
            boxSizing: "border-box",
            resize: "none",
            border: "none",
            outline: "none",
            background: "transparent",
            color: tokens.textPrimary,
            padding: `${space(1.5)}px ${space(2)}px`,
            lineHeight: 1.6,
            maxHeight: MAX_HEIGHT,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: space(1) }}>
          {trailing}
          <div style={{ flex: 1 }} />
          {busy ? (
            <IconButton title={t.stop} onClick={onStop}>
              <Square size={14} strokeWidth={2} fill="currentColor" />
            </IconButton>
          ) : (
            <button
              type="button"
              title={t.send}
              disabled={!canSend}
              onClick={onSubmit}
              style={{
                width: 30,
                height: 30,
                borderRadius: radius.pill,
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: canSend ? tokens.accent : tokens.controlIdle,
                color: canSend ? tokens.onAccent : tokens.textTertiary,
                cursor: canSend ? "pointer" : "not-allowed",
                transition: "background 120ms ease",
                flex: "0 0 auto",
              }}
            >
              <ArrowUp size={16} strokeWidth={2.25} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
