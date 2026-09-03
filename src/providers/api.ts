import { invoke, isTauri } from "../tauri";

export interface Model {
  id: string;
  name: string;
}

/** What the provider list returns — never carries the API key itself. */
export interface ProviderInfo {
  id: string;
  name: string;
  kind: string;
  baseUrl: string;
  enabled: boolean;
  hasKey: boolean;
  models: Model[];
  defaultModel: string | null;
  createdAt: string;
}

export interface ProviderInput {
  id?: string | null;
  name: string;
  kind?: string;
  baseUrl: string;
  /** Omit to leave the stored key untouched. */
  apiKey?: string | null;
  enabled: boolean;
}

const preview: { providers: ProviderInfo[] } = {
  providers: [
    {
      id: "openrouter-preview",
      name: "OpenRouter",
      kind: "openai_compatible",
      baseUrl: "https://openrouter.ai/api/v1",
      enabled: true,
      hasKey: false,
      // A spread of vendors so the brand-icon matching is visible while
      // iterating on this screen without a real API key.
      models: [
        { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
        { id: "openai/gpt-5", name: "GPT-5" },
        { id: "deepseek/deepseek-chat", name: "DeepSeek Chat" },
        { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
        { id: "qwen/qwen3-235b", name: "Qwen3 235B" },
        { id: "moonshotai/kimi-k2", name: "Kimi K2" },
        { id: "acme/unknown-model", name: "Unknown Vendor" },
      ],
      defaultModel: "anthropic/claude-sonnet-4.5",
      createdAt: "2026-09-01T10:00:00Z",
    },
  ],
};

export async function listProviders(): Promise<ProviderInfo[]> {
  if (isTauri()) return invoke<ProviderInfo[]>("list_providers");
  return [...preview.providers];
}

export async function upsertProvider(input: ProviderInput): Promise<ProviderInfo> {
  if (isTauri()) return invoke<ProviderInfo>("upsert_provider", { input });
  const existing = preview.providers.find((p) => p.id === input.id);
  if (existing) {
    Object.assign(existing, {
      name: input.name,
      baseUrl: input.baseUrl,
      enabled: input.enabled,
      hasKey: input.apiKey ? input.apiKey.length > 0 : existing.hasKey,
    });
    return existing;
  }
  const created: ProviderInfo = {
    id: `provider-${Date.now()}`,
    name: input.name,
    kind: input.kind ?? "openai_compatible",
    baseUrl: input.baseUrl,
    enabled: input.enabled,
    hasKey: Boolean(input.apiKey),
    models: [],
    defaultModel: null,
    createdAt: new Date().toISOString(),
  };
  preview.providers = [...preview.providers, created];
  return created;
}

export async function deleteProvider(id: string): Promise<void> {
  if (isTauri()) return invoke<void>("delete_provider", { id });
  preview.providers = preview.providers.filter((p) => p.id !== id);
}

export async function setProviderKey(id: string, apiKey: string): Promise<ProviderInfo> {
  if (isTauri()) return invoke<ProviderInfo>("set_provider_key", { id, apiKey });
  const provider = preview.providers.find((p) => p.id === id);
  if (!provider) throw new Error(`No such provider: ${id}`);
  provider.hasKey = apiKey.length > 0;
  return provider;
}

/**
 * Fetch the raw key so a request can be signed.
 *
 * This is the single intentional exception to "credentials stay in Rust" — it
 * exists because the agent loop runs here in JS. Call it at the moment a client
 * is constructed and let the value fall out of scope; never park it in React
 * state or a module-level cache.
 */
export async function getProviderKey(id: string): Promise<string> {
  if (isTauri()) return invoke<string>("get_provider_key", { id });
  throw new Error("API keys are unavailable in browser preview");
}

export async function setProviderModels(id: string, models: Model[]): Promise<ProviderInfo> {
  if (isTauri()) return invoke<ProviderInfo>("set_provider_models", { id, models });
  const provider = preview.providers.find((p) => p.id === id);
  if (!provider) throw new Error(`No such provider: ${id}`);
  provider.models = models;
  return provider;
}

export async function setProviderDefaultModel(
  id: string,
  model: string | null,
): Promise<ProviderInfo> {
  if (isTauri()) return invoke<ProviderInfo>("set_provider_default_model", { id, model });
  const provider = preview.providers.find((p) => p.id === id);
  if (!provider) throw new Error(`No such provider: ${id}`);
  provider.defaultModel = model;
  return provider;
}
