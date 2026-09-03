import { useState, type CSSProperties, type ReactNode } from "react";

import { radius, space, type as typeScale, useTokens } from "../theme";

/**
 * The small set of controls every screen in MolWhale reuses.
 *
 * These are plain DOM elements rather than react-native-web `View`/`Pressable`:
 * the app is desktop-only, and hover, focus rings and `cursor` — all of which
 * this chrome depends on — are exactly what RNW's abstraction makes awkward.
 * Layout components still use RNW; these are the leaves.
 */

export function Button({
  children,
  onClick,
  variant = "secondary",
  disabled,
  title,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  title?: string;
  style?: CSSProperties;
}) {
  const tokens = useTokens();
  const [hovered, setHovered] = useState(false);

  const palette: Record<string, CSSProperties> = {
    primary: {
      background: disabled ? tokens.controlIdle : tokens.accent,
      color: disabled ? tokens.textTertiary : tokens.onAccent,
      border: "1px solid transparent",
    },
    secondary: {
      background: hovered && !disabled ? tokens.controlHover : tokens.controlIdle,
      color: tokens.textPrimary,
      border: `1px solid ${tokens.controlBorder}`,
    },
    ghost: {
      background: hovered && !disabled ? tokens.controlHover : "transparent",
      color: tokens.textSecondary,
      border: "1px solid transparent",
    },
    danger: {
      background: hovered && !disabled ? "rgba(241, 112, 123, 0.16)" : "transparent",
      color: tokens.danger,
      border: `1px solid ${hovered ? "rgba(241, 112, 123, 0.4)" : tokens.controlBorder}`,
    },
  };

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...typeScale.label,
        padding: `${space(1.5)}px ${space(3)}px`,
        borderRadius: radius.md,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "background 120ms ease, border-color 120ms ease",
        whiteSpace: "nowrap",
        ...palette[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  onClick,
  title,
  disabled,
  active,
  size = 28,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  active?: boolean;
  size?: number;
}) {
  const tokens = useTokens();
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.sm,
        border: "none",
        background: active
          ? tokens.selection
          : hovered && !disabled
            ? tokens.controlHover
            : "transparent",
        color: disabled ? tokens.textTertiary : active ? tokens.accent : tokens.textSecondary,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background 120ms ease, color 120ms ease",
        flex: "0 0 auto",
      }}
    >
      {children}
    </button>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
  onSubmit,
  autoFocus,
  monospace,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "password";
  onSubmit?: () => void;
  autoFocus?: boolean;
  monospace?: boolean;
}) {
  const tokens = useTokens();
  const [focused, setFocused] = useState(false);

  return (
    <input
      type={type}
      value={value}
      autoFocus={autoFocus}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && onSubmit) {
          event.preventDefault();
          onSubmit();
        }
      }}
      style={{
        ...typeScale.body,
        width: "100%",
        boxSizing: "border-box",
        padding: `${space(2)}px ${space(2.5)}px`,
        borderRadius: radius.md,
        background: tokens.inputFill,
        color: tokens.textPrimary,
        border: `1px solid ${focused ? tokens.accent : tokens.controlBorder}`,
        outline: "none",
        transition: "border-color 120ms ease",
        fontFamily: monospace ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
      }}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  monospace,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  monospace?: boolean;
}) {
  const tokens = useTokens();
  const [focused, setFocused] = useState(false);

  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...typeScale.body,
        width: "100%",
        boxSizing: "border-box",
        padding: `${space(2)}px ${space(2.5)}px`,
        borderRadius: radius.md,
        background: tokens.inputFill,
        color: tokens.textPrimary,
        border: `1px solid ${focused ? tokens.accent : tokens.controlBorder}`,
        outline: "none",
        resize: "vertical",
        transition: "border-color 120ms ease",
        fontFamily: monospace ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
      }}
    />
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const tokens = useTokens();
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      style={{
        ...typeScale.body,
        width: "100%",
        boxSizing: "border-box",
        padding: `${space(2)}px ${space(2.5)}px`,
        borderRadius: radius.md,
        background: tokens.inputFill,
        color: tokens.textPrimary,
        border: `1px solid ${tokens.controlBorder}`,
        outline: "none",
        cursor: "pointer",
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const tokens = useTokens();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space(1.5) }}>
      <span style={{ ...typeScale.label, color: tokens.textSecondary }}>{label}</span>
      {children}
      {hint ? (
        <span style={{ ...typeScale.caption, color: tokens.textTertiary }}>{hint}</span>
      ) : null}
    </div>
  );
}

export function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const tokens = useTokens();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: 38,
        height: 22,
        flex: "0 0 auto",
        borderRadius: radius.pill,
        border: `1px solid ${value ? "transparent" : tokens.controlBorder}`,
        background: value ? tokens.accent : tokens.controlIdle,
        cursor: "pointer",
        padding: 0,
        position: "relative",
        transition: "background 140ms ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: value ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: radius.pill,
          background: value ? tokens.onAccent : tokens.textSecondary,
          transition: "left 140ms ease",
        }}
      />
    </button>
  );
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  const tokens = useTokens();
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: space(2),
        padding: space(6),
        textAlign: "center",
      }}
    >
      <span style={{ ...typeScale.h2, color: tokens.textPrimary }}>{title}</span>
      {body ? (
        <span
          style={{ ...typeScale.body, color: tokens.textTertiary, maxWidth: 380, lineHeight: 1.6 }}
        >
          {body}
        </span>
      ) : null}
      {action}
    </div>
  );
}

export function Banner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  const tokens = useTokens();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: space(2),
        margin: space(3),
        padding: `${space(2)}px ${space(3)}px`,
        borderRadius: radius.md,
        background: "rgba(241, 112, 123, 0.12)",
        border: "1px solid rgba(241, 112, 123, 0.32)",
        color: tokens.danger,
        ...typeScale.caption,
      }}
    >
      <span style={{ flex: 1, wordBreak: "break-word" }}>{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: "transparent",
            border: "none",
            color: tokens.danger,
            cursor: "pointer",
            ...typeScale.caption,
          }}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
