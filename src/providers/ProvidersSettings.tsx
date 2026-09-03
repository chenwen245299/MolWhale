import { useState } from "react";
import { RefreshCw, Star, Trash2 } from "lucide-react";

import { useT } from "../i18n";
import { Banner, Button, Field, IconButton, TextField, Toggle } from "../components/ui";
import { fetchModels } from "../chat/chatRuntime";
import {
  ContextMenu,
  DetailBody,
  DetailHeader,
  EmptyDetail,
  ListColumn,
  ListDetail,
  ListRow,
} from "../settings/layout";
import { radius, space, type as typeScale, useTokens } from "../theme";
import { ApiKeyField } from "./ApiKeyField";
import { BrandIcon, ModelIcon } from "./BrandIcon";
import { NewProviderModal } from "./NewProviderModal";
import {
  deleteProvider,
  setProviderDefaultModel,
  setProviderModels,
  upsertProvider,
  type ProviderInfo,
} from "./api";

/**
 * Model providers, as a list column plus a detail form.
 *
 * The shape follows Nomi's: providers are things you accumulate and switch
 * between, and a stacked card list makes finding one among a dozen harder than
 * a fixed column does.
 */
export function ProvidersSettings({
  providers,
  onReload,
}: {
  providers: ProviderInfo[];
  onReload: () => Promise<void> | void;
}) {
  const t = useT();
  const [preferredId, setPreferredId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; provider: ProviderInfo } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Derived rather than stored: when the preferred provider is deleted, the
  // fallback takes over on the very next render, with no effect to keep the two
  // in step (and no frame showing an empty detail pane).
  const selected =
    providers.find((provider) => provider.id === preferredId) ?? providers[0] ?? null;
  const selectedId = selected?.id ?? null;

  const toggle = async (provider: ProviderInfo, enabled: boolean) => {
    try {
      await upsertProvider({
        id: provider.id,
        name: provider.name,
        kind: provider.kind,
        baseUrl: provider.baseUrl,
        enabled,
      });
      await onReload();
    } catch (cause) {
      setError(String(cause));
    }
  };

  const create = async (name: string, baseUrl: string) => {
    setCreating(false);
    try {
      const created = await upsertProvider({
        name,
        kind: "openai_compatible",
        baseUrl,
        enabled: true,
      });
      await onReload();
      setPreferredId(created.id);
    } catch (cause) {
      setError(String(cause));
    }
  };

  const remove = async (provider: ProviderInfo) => {
    if (!window.confirm(t.confirmDeleteProvider(provider.name))) return;
    try {
      await deleteProvider(provider.id);
      await onReload();
    } catch (cause) {
      setError(String(cause));
    }
  };

  return (
    <>
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}

      <ListDetail
        list={
          <ListColumn
            title={t.apiProviders}
            addLabel={t.addProvider}
            onAdd={() => setCreating(true)}
          >
            {providers.map((provider) => (
              <ListRow
                key={provider.id}
                active={provider.id === selectedId}
                muted={!provider.enabled}
                label={provider.name}
                icon={<BrandIcon name={provider.name} kind={provider.kind} />}
                onSelect={() => setPreferredId(provider.id)}
                onContextMenu={(x, y) => {
                  setPreferredId(provider.id);
                  setMenu({ x, y, provider });
                }}
                trailing={
                  <Toggle
                    value={provider.enabled}
                    onChange={(next) => void toggle(provider, next)}
                  />
                }
              />
            ))}
          </ListColumn>
        }
        detail={
          selected ? (
            <ProviderDetail
              key={selected.id}
              provider={selected}
              onReload={onReload}
              onError={setError}
            />
          ) : (
            <EmptyDetail title={t.noProviderSelected} body={t.noProviderSelectedBody} />
          )
        }
      />

      {creating ? (
        <NewProviderModal
          onClose={() => setCreating(false)}
          onCreate={(n, u) => void create(n, u)}
        />
      ) : null}

      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[{ label: t.delete, danger: true, onSelect: () => void remove(menu.provider) }]}
        />
      ) : null}
    </>
  );
}

function ProviderDetail({
  provider,
  onReload,
  onError,
}: {
  provider: ProviderInfo;
  onReload: () => Promise<void> | void;
  onError: (message: string) => void;
}) {
  const tokens = useTokens();
  const t = useT();
  const [name, setName] = useState(provider.name);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const save = async () => {
    try {
      await upsertProvider({
        id: provider.id,
        name,
        kind: provider.kind,
        baseUrl,
        enabled: provider.enabled,
      });
      await onReload();
    } catch (cause) {
      onError(String(cause));
    }
  };

  const refreshModels = async () => {
    if (!provider.hasKey) {
      onError(t.keyRequired);
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await save();
      const models = await fetchModels({ ...provider, baseUrl });
      await setProviderModels(provider.id, models);
      await onReload();
      setStatus(t.modelsFetched(models.length));
    } catch (cause) {
      onError(String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DetailHeader
        icon={<BrandIcon name={provider.name} kind={provider.kind} size={28} />}
        title={provider.name}
        actions={
          <Button onClick={refreshModels} disabled={busy}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: space(1) }}>
              <RefreshCw size={14} strokeWidth={2} />
              {busy ? t.fetchingModels : t.fetchModels}
            </span>
          </Button>
        }
      />

      <DetailBody>
        <Field label={t.providerName}>
          <TextField value={name} onChange={setName} onSubmit={() => void save()} />
        </Field>

        <Field label={t.providerApiKey}>
          <ApiKeyField provider={provider} onSaved={onReload} onError={onError} />
        </Field>

        <Field label={t.providerBaseUrl}>
          <TextField monospace value={baseUrl} onChange={setBaseUrl} onSubmit={() => void save()} />
        </Field>

        <div style={{ display: "flex", alignItems: "center", gap: space(2) }}>
          <Button variant="primary" onClick={() => void save()}>
            {t.save}
          </Button>
          {status ? (
            <span style={{ ...typeScale.caption, color: tokens.textTertiary }}>{status}</span>
          ) : null}
        </div>

        <ModelList provider={provider} onReload={onReload} onError={onError} />
      </DetailBody>
    </>
  );
}

function ModelList({
  provider,
  onReload,
  onError,
}: {
  provider: ProviderInfo;
  onReload: () => Promise<void> | void;
  onError: (message: string) => void;
}) {
  const tokens = useTokens();
  const t = useT();

  const setDefault = async (modelId: string) => {
    try {
      await setProviderDefaultModel(
        provider.id,
        provider.defaultModel === modelId ? null : modelId,
      );
      await onReload();
    } catch (cause) {
      onError(String(cause));
    }
  };

  const remove = async (modelId: string) => {
    try {
      await setProviderModels(
        provider.id,
        provider.models.filter((model) => model.id !== modelId),
      );
      await onReload();
    } catch (cause) {
      onError(String(cause));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space(2) }}>
      <span style={{ ...typeScale.label, color: tokens.textSecondary }}>
        {t.models} ({provider.models.length})
      </span>

      {provider.models.length === 0 ? (
        <span style={{ ...typeScale.caption, color: tokens.textTertiary }}>{t.noModels}</span>
      ) : null}

      {provider.models.map((model) => {
        const isDefault = provider.defaultModel === model.id;
        return (
          <div
            key={model.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: space(2),
              padding: `${space(2)}px ${space(2.5)}px`,
              borderRadius: radius.md,
              background: tokens.cardSurface,
              border: `1px solid ${isDefault ? tokens.accentMuted : tokens.controlBorder}`,
            }}
          >
            <ModelIcon id={model.id} name={model.name} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span
                style={{
                  ...typeScale.label,
                  color: tokens.textPrimary,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {model.name || model.id}
              </span>
              <code
                style={{
                  ...typeScale.micro,
                  color: tokens.textTertiary,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {model.id}
              </code>
            </div>

            {isDefault ? (
              <span style={{ ...typeScale.micro, color: tokens.accent }}>{t.isDefaultModel}</span>
            ) : null}

            <IconButton
              size={26}
              active={isDefault}
              title={t.setDefaultModel}
              onClick={() => void setDefault(model.id)}
            >
              <Star size={14} strokeWidth={1.75} fill={isDefault ? "currentColor" : "none"} />
            </IconButton>
            <IconButton size={26} title={t.removeModel} onClick={() => void remove(model.id)}>
              <Trash2 size={14} strokeWidth={1.75} />
            </IconButton>
          </div>
        );
      })}
    </div>
  );
}
