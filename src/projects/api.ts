import { revealItemInDir } from "@tauri-apps/plugin-opener";

import { errorMessage, invoke, isTauri } from "../tauri";

export interface StorageStatus {
  rootPath: string;
  configPath: string;
  projectsPath: string;
  reusedExistingData: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  path: string;
  conversationCount: number;
}

export interface Conversation {
  id: string;
  projectId: string;
  title: string;
  providerId: string | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
  path: string;
  filesPath: string;
}

export type StoredMessage = Record<string, unknown>;

// ── Browser-preview fallback ─────────────────────────────────────────────────
// Enough state to exercise the sidebar, selection and empty states without the
// Rust backend running.

const preview = {
  status: {
    rootPath: "/Users/you/Documents/MolWhale",
    configPath: "/Users/you/Documents/MolWhale/.molwhale/config.json",
    projectsPath: "/Users/you/Documents/MolWhale/projects",
    reusedExistingData: true,
  } as StorageStatus | null,
  projects: [
    {
      id: "kinase-inhibitors",
      name: "激酶抑制剂",
      description: "",
      createdAt: "2026-09-01T10:00:00Z",
      path: "/Users/you/Documents/MolWhale/projects/kinase-inhibitors",
      conversationCount: 1,
    },
  ] as Project[],
  conversations: {
    "kinase-inhibitors": [
      {
        id: "scaffold-hopping",
        projectId: "kinase-inhibitors",
        title: "骨架跃迁探索",
        providerId: null,
        model: null,
        createdAt: "2026-09-01T10:05:00Z",
        updatedAt: "2026-09-01T10:05:00Z",
        path: "…/conversations/scaffold-hopping",
        filesPath: "…/conversations/scaffold-hopping/files",
      },
    ],
  } as Record<string, Conversation[]>,
  messages: {} as Record<string, StoredMessage[]>,
};

const slug = (name: string) =>
  name.trim().replace(/[/\\:*?"<>|]/g, "-") || `untitled-${Date.now()}`;

// ── Storage ──────────────────────────────────────────────────────────────────

export async function getStorageStatus(): Promise<StorageStatus | null> {
  if (isTauri()) return invoke<StorageStatus | null>("get_storage_status");
  return preview.status;
}

export async function setStorageRoot(rootPath: string): Promise<StorageStatus> {
  if (isTauri()) return invoke<StorageStatus>("set_storage_root", { rootPath });
  preview.status = {
    rootPath,
    configPath: `${rootPath}/.molwhale/config.json`,
    projectsPath: `${rootPath}/projects`,
    reusedExistingData: false,
  };
  return preview.status;
}

// ── Projects ─────────────────────────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  if (isTauri()) return invoke<Project[]>("list_projects");
  return [...preview.projects];
}

export async function createProject(name: string, description?: string): Promise<Project> {
  if (isTauri()) return invoke<Project>("create_project", { name, description });
  const project: Project = {
    id: slug(name),
    name,
    description: description ?? "",
    createdAt: new Date().toISOString(),
    path: `${preview.status?.projectsPath}/${slug(name)}`,
    conversationCount: 0,
  };
  preview.projects = [project, ...preview.projects];
  preview.conversations[project.id] = [];
  return project;
}

export async function renameProject(id: string, name: string): Promise<Project> {
  if (isTauri()) return invoke<Project>("rename_project", { id, name });
  const project = preview.projects.find((p) => p.id === id);
  if (!project) throw new Error(`No such project: ${id}`);
  project.name = name;
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  if (isTauri()) return invoke<void>("delete_project", { id });
  preview.projects = preview.projects.filter((p) => p.id !== id);
  delete preview.conversations[id];
}

// ── Conversations ────────────────────────────────────────────────────────────

export async function listConversations(projectId: string): Promise<Conversation[]> {
  if (isTauri()) return invoke<Conversation[]>("list_conversations", { projectId });
  return [...(preview.conversations[projectId] ?? [])];
}

export async function createConversation(
  projectId: string,
  title?: string,
  providerId?: string | null,
  model?: string | null,
): Promise<Conversation> {
  if (isTauri())
    return invoke<Conversation>("create_conversation", { projectId, title, providerId, model });
  const id = slug(title || "新对话");
  const now = new Date().toISOString();
  const conversation: Conversation = {
    id,
    projectId,
    title: title || "新对话",
    providerId: providerId ?? null,
    model: model ?? null,
    createdAt: now,
    updatedAt: now,
    path: `…/${id}`,
    filesPath: `…/${id}/files`,
  };
  preview.conversations[projectId] = [conversation, ...(preview.conversations[projectId] ?? [])];
  return conversation;
}

export async function renameConversation(
  projectId: string,
  id: string,
  title: string,
): Promise<Conversation> {
  if (isTauri()) return invoke<Conversation>("rename_conversation", { projectId, id, title });
  const conversation = (preview.conversations[projectId] ?? []).find((c) => c.id === id);
  if (!conversation) throw new Error(`No such conversation: ${id}`);
  conversation.title = title;
  return conversation;
}

export async function setConversationModel(
  projectId: string,
  id: string,
  providerId: string | null,
  model: string | null,
): Promise<Conversation> {
  if (isTauri())
    return invoke<Conversation>("set_conversation_model", { projectId, id, providerId, model });
  const conversation = (preview.conversations[projectId] ?? []).find((c) => c.id === id);
  if (!conversation) throw new Error(`No such conversation: ${id}`);
  conversation.providerId = providerId;
  conversation.model = model;
  return conversation;
}

export async function deleteConversation(projectId: string, id: string): Promise<void> {
  if (isTauri()) return invoke<void>("delete_conversation", { projectId, id });
  preview.conversations[projectId] = (preview.conversations[projectId] ?? []).filter(
    (c) => c.id !== id,
  );
}

// ── Messages ─────────────────────────────────────────────────────────────────

const messageKey = (projectId: string, id: string) => `${projectId}/${id}`;

export async function listMessages(projectId: string, id: string): Promise<StoredMessage[]> {
  if (isTauri()) return invoke<StoredMessage[]>("list_messages", { projectId, id });
  return [...(preview.messages[messageKey(projectId, id)] ?? [])];
}

export async function appendMessage(
  projectId: string,
  id: string,
  message: StoredMessage,
): Promise<void> {
  if (isTauri()) return invoke<void>("append_message", { projectId, id, message });
  const key = messageKey(projectId, id);
  preview.messages[key] = [...(preview.messages[key] ?? []), message];
}

export async function replaceMessages(
  projectId: string,
  id: string,
  messages: StoredMessage[],
): Promise<void> {
  if (isTauri()) return invoke<void>("replace_messages", { projectId, id, messages });
  preview.messages[messageKey(projectId, id)] = [...messages];
}

export { errorMessage };

/**
 * Show a path in Finder.
 *
 * `revealItemInDir` selects the item inside its parent rather than opening it,
 * which is what you want for a folder you are about to drag files into.
 */
export async function revealPath(path: string): Promise<void> {
  if (!isTauri()) return;
  await revealItemInDir(path);
}
