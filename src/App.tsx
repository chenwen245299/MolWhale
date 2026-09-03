import { useCallback, useEffect, useState } from "react";

import { ChatPane } from "./chat/ChatPane";
import { I18nProvider, useI18n } from "./i18n";
import { listMcpServers, type McpServerConfig } from "./mcp/api";
import { LeftSidebar, type SidebarView } from "./shell/LeftSidebar";
import { RightSidebar } from "./shell/RightSidebar";
import { SplitHandle } from "./shell/SplitHandle";
import { WorkspacePicker } from "./shell/WorkspacePicker";
import { WorkflowsPane } from "./shell/WorkflowsPane";
import { useDragSplit } from "./shell/useDragSplit";
import { readExpanded, writeExpanded } from "./shell/expandedState";
import { SettingsModal } from "./settings/SettingsModal";
import { getSettings, type AppSettings } from "./settings/api";
import { listProviders, type ProviderInfo } from "./providers/api";
import { ThemeProvider, collapseTransition, darkTokens, useTokens } from "./theme";
import { useT } from "./i18n";
import { Banner } from "./components/ui";
import {
  createConversation,
  createProject,
  deleteConversation,
  deleteProject,
  getStorageStatus,
  listConversations,
  listProjects,
  setConversationModel,
  type Conversation,
  type Project,
  type StorageStatus,
} from "./projects/api";

/**
 * The shell.
 *
 * Three columns with two draggable seams; the right column carries a third,
 * horizontal seam of its own (see `RightSidebar`). All of them go through
 * `useDragSplit`, so the sizes persist and the clamping behaves identically.
 */
function Shell() {
  const tokens = useTokens();
  const t = useT();
  const { setLocale } = useI18n();

  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [conversationsByProject, setConversationsByProject] = useState<
    Record<string, Conversation[]>
  >({});
  // Seeded from storage on first render, so a restored expansion is painted
  // with the very first frame rather than snapping open a moment later.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(readExpanded);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServerConfig[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    locale: "zh-CN",
    maxToolRounds: 8,
    systemPrompt: "",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<SidebarView>("chat");
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem("molwhale.leftSidebar.collapsed") === "1";
    } catch {
      // Private windows and blocked site data both throw; start expanded.
      return false;
    }
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("molwhale.leftSidebar.collapsed", next ? "1" : "0");
      } catch {
        // Remembering the state is a convenience, never a requirement.
      }
      return next;
    });
  }, []);

  // Cmd/Ctrl+B, the near-universal binding for this in editors and chat apps.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleCollapsed();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  const leftSplit = useDragSplit({
    axis: "x",
    direction: "start",
    initial: 248,
    min: 180,
    max: 420,
    storageKey: "molwhale.leftSidebar.width",
  });

  const rightSplit = useDragSplit({
    axis: "x",
    direction: "end",
    initial: 320,
    min: 220,
    max: 560,
    storageKey: "molwhale.rightSidebar.width",
  });

  // ── Loading ───────────────────────────────────────────────────────────────

  const reloadProviders = useCallback(async () => {
    try {
      setProviders(await listProviders());
    } catch (cause) {
      setError(String(cause));
    }
  }, []);

  const reloadMcpServers = useCallback(async () => {
    try {
      setMcpServers(await listMcpServers());
    } catch (cause) {
      setError(String(cause));
    }
  }, []);

  const reloadProjects = useCallback(async () => {
    try {
      const loaded = await listProjects();
      setProjects(loaded);
      return loaded;
    } catch (cause) {
      setError(String(cause));
      return [];
    }
  }, []);

  const reloadConversations = useCallback(async (projectId: string) => {
    try {
      const conversations = await listConversations(projectId);
      setConversationsByProject((current) => ({ ...current, [projectId]: conversations }));
      return conversations;
    } catch (cause) {
      setError(String(cause));
      return [];
    }
  }, []);

  useEffect(() => {
    void getStorageStatus()
      .then(setStorage)
      .catch((cause) => setError(String(cause)))
      .finally(() => setCheckedStorage(true));
  }, []);

  // Everything else is meaningless until a workspace exists, so it all hangs
  // off the storage status rather than loading on mount. The four reads are
  // independent, so they go out together; `cancelled` covers the user changing
  // workspace folder while one is still in flight.
  useEffect(() => {
    if (!storage) return;
    let cancelled = false;

    void (async () => {
      const [loadedSettings, loadedProjects] = await Promise.all([
        getSettings().catch(() => null),
        reloadProjects(),
        reloadProviders(),
        reloadMcpServers(),
      ]);
      if (cancelled) return;

      // A project restored as expanded has to have its conversations fetched,
      // or it opens to an empty list until the user collapses and reopens it.
      const restored = readExpanded();
      await Promise.all(
        loadedProjects
          .filter((entry) => restored[entry.id])
          .map((entry) => reloadConversations(entry.id)),
      );
      if (cancelled) return;

      if (loadedSettings) {
        setSettings(loadedSettings);
        setLocale(loadedSettings.locale);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storage, reloadProjects, reloadProviders, reloadMcpServers, reloadConversations, setLocale]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const onToggleProject = (projectId: string) => {
    // Computed outside the updater: persisting and lazy-loading are side
    // effects, and React may invoke an updater more than once.
    const next = { ...expanded, [projectId]: !expanded[projectId] };
    setExpanded(next);
    writeExpanded(
      next,
      projects.map((entry) => entry.id),
    );
    if (next[projectId] && !conversationsByProject[projectId]) {
      void reloadConversations(projectId);
    }
  };

  const onSelectProject = (projectId: string) => {
    setView("chat");
    setSelectedProjectId(projectId);
    setSelectedConversationId(null);
    if (!conversationsByProject[projectId]) void reloadConversations(projectId);
  };

  const onCreateProject = async (name: string) => {
    try {
      const project = await createProject(name);
      await reloadProjects();
      setExpanded((current) => ({ ...current, [project.id]: true }));
      setSelectedProjectId(project.id);
      setSelectedConversationId(null);
      await reloadConversations(project.id);
    } catch (cause) {
      setError(String(cause));
    }
  };

  const onCreateConversation = async () => {
    if (!selectedProjectId) return;
    setView("chat");
    try {
      const conversation = await createConversation(selectedProjectId);
      await reloadConversations(selectedProjectId);
      setExpanded((current) => ({ ...current, [selectedProjectId]: true }));
      setSelectedConversationId(conversation.id);
    } catch (cause) {
      setError(String(cause));
    }
  };

  const onDeleteProject = async (project: Project) => {
    if (!window.confirm(t.confirmDeleteProject(project.name))) return;
    try {
      await deleteProject(project.id);
      if (selectedProjectId === project.id) {
        setSelectedProjectId(null);
        setSelectedConversationId(null);
      }
      await reloadProjects();
    } catch (cause) {
      setError(String(cause));
    }
  };

  const onDeleteConversation = async (conversation: Conversation) => {
    if (!window.confirm(t.confirmDeleteConversation(conversation.title))) return;
    try {
      await deleteConversation(conversation.projectId, conversation.id);
      if (selectedConversationId === conversation.id) setSelectedConversationId(null);
      await reloadConversations(conversation.projectId);
    } catch (cause) {
      setError(String(cause));
    }
  };

  const onModelChange = async (providerId: string, model: string) => {
    if (!selectedProjectId || !selectedConversationId) return;
    try {
      await setConversationModel(selectedProjectId, selectedConversationId, providerId, model);
      await reloadConversations(selectedProjectId);
    } catch (cause) {
      setError(String(cause));
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!checkedStorage) {
    return <div style={{ flex: 1, background: tokens.windowBase }} />;
  }

  if (!storage) {
    return <WorkspacePicker onReady={setStorage} />;
  }

  const project = projects.find((entry) => entry.id === selectedProjectId) ?? null;
  const conversation =
    (selectedProjectId ? conversationsByProject[selectedProjectId] : undefined)?.find(
      (entry) => entry.id === selectedConversationId,
    ) ?? null;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: tokens.windowBase,
        minWidth: 0,
      }}
    >
      {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}

      <div style={{ flex: 1, display: "flex", minHeight: 0, minWidth: 0 }}>
        {/* The rail stays mounted and animates its width to zero. The inner
            wrapper keeps its full width throughout, so the content clips
            behind the edge instead of reflowing — text rewrapping mid-slide is
            what makes a collapse look cheap. */}
        <div
          style={{
            width: collapsed ? 0 : leftSplit.size,
            flex: "0 0 auto",
            minWidth: 0,
            overflow: "hidden",
            transition: collapseTransition("width"),
          }}
        >
          <div style={{ width: leftSplit.size, height: "100%" }}>
            <LeftSidebar
              projects={projects}
              conversationsByProject={conversationsByProject}
              expanded={expanded}
              selectedProjectId={selectedProjectId}
              selectedConversationId={selectedConversationId}
              onToggleProject={onToggleProject}
              onSelectProject={onSelectProject}
              onSelectConversation={(projectId, conversationId) => {
                setView("chat");
                setSelectedProjectId(projectId);
                setSelectedConversationId(conversationId);
              }}
              view={view}
              onSelectView={setView}
              onCollapse={toggleCollapsed}
              onCreateProject={(name) => void onCreateProject(name)}
              onCreateConversation={() => void onCreateConversation()}
              onDeleteProject={(entry) => void onDeleteProject(entry)}
              onDeleteConversation={(entry) => void onDeleteConversation(entry)}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
        </div>

        <SplitHandle split={leftSplit} orientation="vertical" collapsed={collapsed} />

        {view === "workflows" ? (
          <WorkflowsPane sidebarCollapsed={collapsed} onExpandSidebar={toggleCollapsed} />
        ) : (
          <ChatPane
            key={conversation?.id ?? "none"}
            project={project}
            conversation={conversation}
            providers={providers}
            settings={settings}
            sidebarCollapsed={collapsed}
            onExpandSidebar={toggleCollapsed}
            onModelChange={(providerId, model) => void onModelChange(providerId, model)}
          />
        )}

        <SplitHandle split={rightSplit} orientation="vertical" />

        <div style={{ width: rightSplit.size, flex: "0 0 auto", minWidth: 0 }}>
          <RightSidebar
            context={{
              projectId: selectedProjectId,
              conversationId: selectedConversationId,
            }}
          />
        </div>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
        providers={providers}
        reloadProviders={reloadProviders}
        mcpServers={mcpServers}
        reloadMcpServers={reloadMcpServers}
        storage={storage}
        onChangeFolder={() => {
          // Sending the user back through the picker is the whole "change
          // folder" flow: adopting a new root re-reads everything from scratch.
          setSettingsOpen(false);
          setStorage(null);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider value={darkTokens}>
      <I18nProvider>
        <Shell />
      </I18nProvider>
    </ThemeProvider>
  );
}
