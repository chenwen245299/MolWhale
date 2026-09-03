import { useMemo } from "react";
import { ChevronDown } from "lucide-react";

import type { ProviderInfo } from "../providers/api";
import { decode, encode } from "./modelValue";
import { radius, space, type as typeScale, useTokens } from "../theme";

/**
 * Provider + model in one control. The `providerId::modelId` encoding lives in
 * `modelValue.ts` so this file exports only a component.
 */
export function ModelPicker({
  providers,
  providerId,
  model,
  onChange,
}: {
  providers: ProviderInfo[];
  providerId: string | null;
  model: string | null;
  onChange: (providerId: string, model: string) => void;
}) {
  const tokens = useTokens();

  const groups = useMemo(
    () => providers.filter((provider) => provider.enabled && provider.models.length > 0),
    [providers],
  );

  const value = providerId && model ? encode(providerId, model) : "";

  // Nothing to pick from yet — say so instead of rendering an empty dropdown
  // the user can click forever.
  if (groups.length === 0) {
    return (
      <span
        style={{ ...typeScale.caption, color: tokens.textTertiary, padding: `0 ${space(1)}px` }}
      >
        {providers.length === 0 ? "—" : "设置 → 模型服务"}
      </span>
    );
  }

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <select
        value={value}
        onChange={(event) => {
          const decoded = decode(event.target.value);
          if (decoded) onChange(decoded.providerId, decoded.model);
        }}
        style={{
          ...typeScale.caption,
          appearance: "none",
          background: "transparent",
          border: `1px solid transparent`,
          borderRadius: radius.md,
          color: tokens.textSecondary,
          padding: `${space(1)}px ${space(4)}px ${space(1)}px ${space(1.5)}px`,
          cursor: "pointer",
          maxWidth: 260,
          outline: "none",
        }}
      >
        {value === "" ? <option value="">—</option> : null}
        {groups.map((provider) => (
          <optgroup key={provider.id} label={provider.name}>
            {provider.models.map((entry) => (
              <option key={`${provider.id}::${entry.id}`} value={encode(provider.id, entry.id)}>
                {entry.name || entry.id}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown
        size={13}
        color={tokens.textTertiary}
        style={{ position: "absolute", right: space(1.5), pointerEvents: "none" }}
      />
    </div>
  );
}
