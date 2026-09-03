import { useState } from "react";

import { useT } from "../i18n";
import { Button, TextField } from "../components/ui";
import { space, type as typeScale, useTokens } from "../theme";
import { setProviderKey, type ProviderInfo } from "./api";

/**
 * Write-only API key control.
 *
 * A stored key is never sent back to the UI (`ProviderInfo` carries `hasKey`,
 * not the secret), so there is nothing to render in the input — hence dots plus
 * an explicit "change key" step rather than a field that looks editable but
 * would silently blank the key if saved empty.
 */
export function ApiKeyField({
  provider,
  onSaved,
  onError,
}: {
  provider: ProviderInfo;
  onSaved: () => Promise<void> | void;
  onError: (message: string) => void;
}) {
  const tokens = useTokens();
  const t = useT();
  const [editing, setEditing] = useState(!provider.hasKey);
  const [value, setValue] = useState("");

  const save = async () => {
    try {
      await setProviderKey(provider.id, value.trim());
      setValue("");
      setEditing(false);
      await onSaved();
    } catch (cause) {
      onError(String(cause));
    }
  };

  if (provider.hasKey && !editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: space(3) }}>
        <span
          style={{
            ...typeScale.body,
            color: tokens.textTertiary,
            letterSpacing: 3,
            userSelect: "none",
          }}
        >
          ••••••••
        </span>
        <Button
          onClick={() => {
            setEditing(true);
            setValue("");
          }}
        >
          {t.editKey}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: space(2) }}>
      <TextField
        type="password"
        value={value}
        onChange={setValue}
        onSubmit={() => void save()}
        placeholder="sk-..."
      />
      <Button variant="primary" onClick={() => void save()}>
        {t.save}
      </Button>
      {provider.hasKey ? (
        <Button
          variant="ghost"
          onClick={() => {
            setEditing(false);
            setValue("");
          }}
        >
          {t.cancel}
        </Button>
      ) : null}
    </div>
  );
}
