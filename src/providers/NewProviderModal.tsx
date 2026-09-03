import { useState } from "react";

import { useT } from "../i18n";
import { Button, Field, TextField } from "../components/ui";
import { radius, space, type as typeScale, useTokens } from "../theme";
import { BrandIcon } from "./BrandIcon";

/**
 * Known providers, so naming one is enough to fill in its base URL.
 *
 * Typing "DeepSeek" and then having to look up `https://api.deepseek.com` is
 * the kind of friction that makes people give up on a settings screen; the
 * match is a substring test on the name the user typed.
 */
const PRESETS: { keys: string[]; baseUrl: string }[] = [
  { keys: ["openrouter"], baseUrl: "https://openrouter.ai/api/v1" },
  { keys: ["deepseek"], baseUrl: "https://api.deepseek.com/v1" },
  { keys: ["openai", "chatgpt"], baseUrl: "https://api.openai.com/v1" },
  { keys: ["moonshot", "kimi"], baseUrl: "https://api.moonshot.cn/v1" },
  {
    keys: ["qwen", "dashscope", "通义", "千问"],
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  { keys: ["zhipu", "glm", "智谱"], baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
  { keys: ["siliconflow", "硅基"], baseUrl: "https://api.siliconflow.cn/v1" },
  { keys: ["minimax"], baseUrl: "https://api.minimax.chat/v1" },
  { keys: ["ollama"], baseUrl: "http://localhost:11434/v1" },
  { keys: ["lmstudio", "lm studio"], baseUrl: "http://localhost:1234/v1" },
];

function presetBaseUrl(name: string): string {
  const lower = name.trim().toLowerCase();
  if (!lower) return "";
  return PRESETS.find((preset) => preset.keys.some((key) => lower.includes(key)))?.baseUrl ?? "";
}

export function NewProviderModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, baseUrl: string) => void;
}) {
  const tokens = useTokens();
  const t = useT();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  // An untouched URL field keeps tracking the name; once edited it stops, so a
  // deliberate custom endpoint is not overwritten by the next keystroke.
  const [urlTouched, setUrlTouched] = useState(false);

  const effectiveUrl = urlTouched ? baseUrl : presetBaseUrl(name);
  const canCreate = name.trim().length > 0 && effectiveUrl.trim().length > 0;

  const submit = () => {
    if (canCreate) onCreate(name.trim(), effectiveUrl.trim());
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: tokens.scrim,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(420px, 90vw)",
          background: tokens.overlaySurface,
          borderRadius: radius.xl,
          border: `1px solid ${tokens.separatorStrong}`,
          padding: space(4),
          display: "flex",
          flexDirection: "column",
          gap: space(3),
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: space(2) }}>
          <BrandIcon name={name} kind="openai_compatible" size={24} />
          <span style={{ ...typeScale.h2, color: tokens.textPrimary }}>{t.newProviderTitle}</span>
        </div>

        <Field label={t.providerName} hint={t.newProviderNameHint}>
          <TextField
            autoFocus
            value={name}
            onChange={setName}
            onSubmit={submit}
            placeholder="OpenRouter"
          />
        </Field>

        <Field label={t.providerBaseUrl}>
          <TextField
            monospace
            value={effectiveUrl}
            onChange={(value) => {
              setUrlTouched(true);
              setBaseUrl(value);
            }}
            onSubmit={submit}
            placeholder="https://…/v1"
          />
        </Field>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: space(2) }}>
          <Button variant="ghost" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button variant="primary" disabled={!canCreate} onClick={submit}>
            {t.create}
          </Button>
        </div>
      </div>
    </div>
  );
}
