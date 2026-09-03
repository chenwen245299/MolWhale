import { useState } from "react";
import { Globe, TerminalSquare } from "lucide-react";

import { useT } from "../i18n";
import { Banner, Button, Field, Select, TextArea, TextField, Toggle } from "../components/ui";
import {
  ContextMenu,
  DetailBody,
  DetailHeader,
  EmptyDetail,
  ListColumn,
  ListDetail,
  ListRow,
} from "../settings/layout";
import { space, type as typeScale, useTokens } from "../theme";
import { connect, listTools } from "./client";
import {
  deleteMcpServer,
  emptyServer,
  upsertMcpServer,
  type McpServerConfig,
  type McpTransport,
} from "./api";

/**
 * MCP servers, in the same list-and-detail shape as the providers pane.
 *
 * "Test" performs a real connection: spawn (or HTTP handshake), initialize,
 * list tools, disconnect. That is the only check worth offering — a config can
 * look perfect and still fail because `npx` is not on the PATH a GUI app
 * inherits, and only an actual launch surfaces that.
 */
export function McpSettings({
  servers,
  onReload,
}: {
  servers: McpServerConfig[];
  onReload: () => Promise<void> | void;
}) {
  const t = useT();
  const [preferredId, setPreferredId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; server: McpServerConfig } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Derived rather than stored — see the note in ProvidersSettings.
  const selected = servers.find((server) => server.id === preferredId) ?? servers[0] ?? null;
  const selectedId = selected?.id ?? null;

  const add = async () => {
    try {
      const created = await upsertMcpServer({
        ...emptyServer("stdio"),
        name: t.newMcpDefaultName,
        command: "npx",
      });
      await onReload();
      setPreferredId(created.id);
    } catch (cause) {
      setError(String(cause));
    }
  };

  const toggle = async (server: McpServerConfig, enabled: boolean) => {
    try {
      await upsertMcpServer({ ...server, enabled });
      await onReload();
    } catch (cause) {
      setError(String(cause));
    }
  };

  const remove = async (server: McpServerConfig) => {
    if (!window.confirm(t.confirmDeleteMcpServer(server.name))) return;
    try {
      await deleteMcpServer(server.id);
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
          <ListColumn title={t.mcpServers} addLabel={t.addMcpServer} onAdd={() => void add()}>
            {servers.map((server) => (
              <ListRow
                key={server.id}
                active={server.id === selectedId}
                muted={!server.enabled}
                label={server.name}
                icon={<TransportIcon transport={server.transport} />}
                onSelect={() => setPreferredId(server.id)}
                onContextMenu={(x, y) => {
                  setPreferredId(server.id);
                  setMenu({ x, y, server });
                }}
                trailing={
                  <Toggle value={server.enabled} onChange={(next) => void toggle(server, next)} />
                }
              />
            ))}
          </ListColumn>
        }
        detail={
          selected ? (
            <ServerDetail
              key={selected.id}
              server={selected}
              onReload={onReload}
              onError={setError}
            />
          ) : (
            <EmptyDetail title={t.noMcpSelected} body={t.noMcpSelectedBody} />
          )
        }
      />

      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[{ label: t.delete, danger: true, onSelect: () => void remove(menu.server) }]}
        />
      ) : null}
    </>
  );
}

function TransportIcon({ transport }: { transport: McpTransport }) {
  const tokens = useTokens();
  const Icon = transport === "stdio" ? TerminalSquare : Globe;
  return (
    <div
      style={{
        width: 26,
        height: 26,
        flex: "0 0 auto",
        borderRadius: 7,
        background: tokens.cardSurface,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: tokens.textSecondary,
      }}
    >
      <Icon size={15} strokeWidth={1.75} />
    </div>
  );
}

/** `KEY=VALUE` per line ⇄ a record — the shape both env and headers use. */
const recordToText = (record: Record<string, string>) =>
  Object.entries(record)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

function textToRecord(text: string): Record<string, string> {
  const record: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    record[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
  return record;
}

function ServerDetail({
  server,
  onReload,
  onError,
}: {
  server: McpServerConfig;
  onReload: () => Promise<void> | void;
  onError: (message: string) => void;
}) {
  const tokens = useTokens();
  const t = useT();

  const [draft, setDraft] = useState<McpServerConfig>(server);
  const [argsText, setArgsText] = useState(server.args.join("\n"));
  const [envText, setEnvText] = useState(recordToText(server.env));
  const [headersText, setHeadersText] = useState(recordToText(server.headers));
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const collect = (): McpServerConfig => ({
    ...draft,
    args: argsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    env: textToRecord(envText),
    headers: textToRecord(headersText),
  });

  const save = async () => {
    try {
      await upsertMcpServer(collect());
      await onReload();
    } catch (cause) {
      onError(String(cause));
    }
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const saved = collect();
      await upsertMcpServer(saved);
      await onReload();
      const connection = await connect(saved);
      try {
        const tools = await listTools(connection);
        setResult({
          ok: true,
          message:
            t.mcpToolsFound(tools.length) +
            (tools.length ? `: ${tools.map((tool) => tool.toolName).join(", ")}` : ""),
        });
      } finally {
        await connection.close();
      }
    } catch (cause) {
      setResult({ ok: false, message: String(cause) });
    } finally {
      setTesting(false);
    }
  };

  const isStdio = draft.transport === "stdio";

  return (
    <>
      <DetailHeader
        icon={<TransportIcon transport={draft.transport} />}
        title={server.name}
        actions={
          <Button onClick={test} disabled={testing}>
            {testing ? t.mcpConnecting : t.test}
          </Button>
        }
      />

      <DetailBody>
        <Field label={t.providerName}>
          <TextField
            value={draft.name}
            onChange={(name) => setDraft({ ...draft, name })}
            onSubmit={() => void save()}
          />
        </Field>

        <Field label={t.mcpTransport}>
          <Select<McpTransport>
            value={draft.transport}
            onChange={(transport) => setDraft({ ...draft, transport })}
            options={[
              { value: "stdio", label: t.mcpStdio },
              { value: "http", label: t.mcpHttp },
            ]}
          />
        </Field>

        {isStdio ? (
          <>
            <Field label={t.mcpCommand}>
              <TextField
                monospace
                value={draft.command}
                onChange={(command) => setDraft({ ...draft, command })}
                onSubmit={() => void save()}
                placeholder="npx"
              />
            </Field>
            <Field label={t.mcpArgs}>
              <TextArea
                monospace
                rows={3}
                value={argsText}
                onChange={setArgsText}
                placeholder={"-y\n@modelcontextprotocol/server-filesystem"}
              />
            </Field>
            <Field label={t.mcpEnv}>
              <TextArea monospace rows={2} value={envText} onChange={setEnvText} />
            </Field>
            <Field label={t.mcpCwd}>
              <TextField
                monospace
                value={draft.cwd}
                onChange={(cwd) => setDraft({ ...draft, cwd })}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label={t.mcpUrl}>
              <TextField
                monospace
                value={draft.url}
                onChange={(url) => setDraft({ ...draft, url })}
                onSubmit={() => void save()}
                placeholder="https://example.com/mcp"
              />
            </Field>
            <Field label={t.mcpHeaders}>
              <TextArea monospace rows={2} value={headersText} onChange={setHeadersText} />
            </Field>
          </>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: space(2), flexWrap: "wrap" }}>
          <Button variant="primary" onClick={() => void save()}>
            {t.save}
          </Button>
          {result ? (
            <span
              style={{
                ...typeScale.caption,
                color: result.ok ? tokens.success : tokens.danger,
                wordBreak: "break-word",
                flex: 1,
                minWidth: 0,
              }}
            >
              {result.message}
            </span>
          ) : null}
        </div>
      </DetailBody>
    </>
  );
}
