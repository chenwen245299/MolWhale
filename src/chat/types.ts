/** A tool call the assistant asked for, plus its result once it has one. */
export interface ToolInvocation {
  id: string;
  /** The namespaced name the model used. */
  name: string;
  arguments: string;
  result?: string;
  isError?: boolean;
}

export type MessageRole = "user" | "assistant" | "system";

/**
 * One message as MolWhale stores and renders it.
 *
 * This is deliberately *not* OpenAI's wire shape: tool calls and their results
 * are folded into the assistant message that made them, so the transcript reads
 * as a sequence of turns rather than the flat user/assistant/tool/assistant
 * chain the API wants. `toWireMessages` in `chatRuntime.ts` does the
 * translation at request time.
 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  toolCalls?: ToolInvocation[];
  /** Set when the turn ended in a failure the user should see. */
  error?: string;
}

export function newMessage(role: MessageRole, content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}
