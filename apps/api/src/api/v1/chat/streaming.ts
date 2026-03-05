import { Hono } from "hono";
import { z } from "zod";
import type { ToolSet } from "ai";
import { createChatAgent } from "@or/agent";
import type { ChatMessage, ContentPart } from "@or/agent";
import { authMiddleware } from "../../../middleware/auth.js";
import { requireWorkspaceMember } from "../../../middleware/workspace-auth.js";
import * as chatStore from "../../../services/chat-store.js";
import * as chatImageStore from "../../../services/chat-image-store.js";
import { buildChatContext } from "../../../services/chat-context.js";
import { toolRegistry, memoryProvider } from "../../../tools/index.js";
import {
  getAiChatProvider,
  getAiChatModel,
  getOpenAiApiKey,
  getAnthropicApiKey,
} from "../../../config.js";
import { query } from "../../../db/index.js";

type Env = {
  Variables: {
    userId: string;
    userEmail: string;
    apiTokenWorkspaceId?: string;
  };
};

const app = new Hono<Env>();
app.use("*", authMiddleware as never);

// ── Schemas ───────────────────────────────────────────────────────────────

const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().min(1),
    }),
  ).min(1),
  mode: z.enum(["agent", "ask", "plan"]).default("agent"),
  model: z.string().optional(),
  conversationId: z.string().uuid().optional(),
  imageIds: z.array(z.string().uuid()).optional(),
});

// ── Model catalogue ───────────────────────────────────────────────────────

interface ModelEntry {
  id: string;
  name: string;
  provider: "openai" | "anthropic";
}

const OPENAI_MODELS: ModelEntry[] = [
  { id: "chatgpt-5", name: "ChatGPT-5", provider: "openai" },
  { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai" },
  { id: "gpt-4.1", name: "GPT-4.1", provider: "openai" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "openai" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", provider: "openai" },
  { id: "o3-mini", name: "o3 Mini", provider: "openai" },
];

const ANTHROPIC_MODELS: ModelEntry[] = [
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "anthropic" },
  { id: "claude-opus-4-20250514", name: "Claude Opus 4", provider: "anthropic" },
  { id: "claude-haiku-3.5-20241022", name: "Claude Haiku 3.5", provider: "anthropic" },
];

const PROVIDER_MODELS: Record<string, ModelEntry[]> = {
  openai: OPENAI_MODELS,
  anthropic: ANTHROPIC_MODELS,
};

// ── Agent helpers ─────────────────────────────────────────────────────────

const WRITE_TOOLS = new Set(["createBundle", "createTicket", "saveMemory"]);

function filterReadOnlyTools(tools: ToolSet): ToolSet {
  const filtered: ToolSet = {};
  for (const [name, def] of Object.entries(tools)) {
    if (!WRITE_TOOLS.has(name)) filtered[name] = def;
  }
  return filtered;
}

async function resolveConnectedProviders(workspaceId: string): Promise<
  { provider: "openai" | "anthropic"; apiKey: string; defaultModel: string }[]
> {
  try {
    const result = await query<{ provider: string; config: Record<string, string> }>(
      `SELECT provider, config FROM workspace_integrations WHERE workspace_id = $1`,
      [workspaceId],
    );
    const providers: { provider: "openai" | "anthropic"; apiKey: string; defaultModel: string }[] = [];
    for (const row of result.rows) {
      if (row.provider === "openai" && row.config.api_key?.trim()) {
        providers.push({ provider: "openai", apiKey: row.config.api_key.trim(), defaultModel: row.config.model?.trim() || "gpt-4o-mini" });
      }
      if (row.provider === "anthropic" && row.config.api_key?.trim()) {
        providers.push({ provider: "anthropic", apiKey: row.config.api_key.trim(), defaultModel: row.config.model?.trim() || "claude-sonnet-4-20250514" });
      }
    }
    if (providers.length > 0) return providers;
  } catch {
    // Fall through to env-based config
  }
  const provider = getAiChatProvider();
  if (provider === "stub") return [];
  const apiKey = provider === "openai" ? getOpenAiApiKey() : getAnthropicApiKey();
  if (!apiKey) return [];
  return [{ provider, apiKey, defaultModel: getAiChatModel() }];
}

function providerForModel(modelId: string): "openai" | "anthropic" | null {
  if (OPENAI_MODELS.some((m) => m.id === modelId)) return "openai";
  if (ANTHROPIC_MODELS.some((m) => m.id === modelId)) return "anthropic";
  return null;
}

async function resolveAgent(workspaceId: string, modelOverride?: string) {
  const connected = await resolveConnectedProviders(workspaceId);
  if (connected.length === 0) return createChatAgent({ provider: "stub" });
  if (modelOverride) {
    const targetProvider = providerForModel(modelOverride);
    const match = targetProvider ? connected.find((c) => c.provider === targetProvider) : connected[0];
    if (match) return createChatAgent({ provider: match.provider, apiKey: match.apiKey, modelName: modelOverride });
  }
  const first = connected[0];
  return createChatAgent({ provider: first.provider, apiKey: first.apiKey, modelName: first.defaultModel });
}

// ── Streaming chat ────────────────────────────────────────────────────────

app.post("/workspaces/:workspaceId/chat", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) return c.json({ error: memberCheck.error }, memberCheck.status);

  const body = await c.req.json().catch(() => ({}));
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);

  const { messages, mode, model: modelOverride, conversationId: existingConvId, imageIds } = parsed.data;
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) return c.json({ error: "No user message found" }, 400);

  let conversationId = existingConvId;
  if (conversationId) {
    const conv = await chatStore.getConversation(conversationId);
    if (!conv || conv.workspace_id !== workspaceId || conv.user_id !== userId) {
      return c.json({ error: "Conversation not found" }, 404);
    }
  } else {
    const conv = await chatStore.createConversation(workspaceId, userId, lastUserMsg.content.slice(0, 100));
    conversationId = conv.id;
  }

  await chatStore.addMessage(conversationId, lastUserMsg.role, lastUserMsg.content, imageIds);

  const allTools = toolRegistry.build({ workspaceId, userId, conversationId });
  const tools = mode === "agent" ? allTools : filterReadOnlyTools(allTools);
  if (mode !== "agent") console.log(`[chat] mode=${mode}, tools=[${Object.keys(tools).join(",")}]`);

  const [agent, systemContext, recentMemories] = await Promise.all([
    resolveAgent(workspaceId, modelOverride),
    buildChatContext(workspaceId),
    memoryProvider.getRecent(workspaceId, userId, 20),
  ]);

  const memoriesContext = recentMemories.length > 0
    ? recentMemories.map((m) => `[${m.category}] ${m.content}`).join("\n")
    : undefined;

  const chatMessages: ChatMessage[] = [];
  for (const m of messages) {
    const isLastUser = m === lastUserMsg && imageIds?.length;
    if (isLastUser) {
      const parts: ContentPart[] = [];
      for (const imgId of imageIds) {
        const img = await chatImageStore.getImage(imgId);
        if (img) parts.push({ type: "image", image: img.data });
      }
      parts.push({ type: "text", text: m.content });
      chatMessages.push({ role: m.role, content: parts });
    } else {
      chatMessages.push({ role: m.role, content: m.content });
    }
  }

  const result = await agent.chat({ messages: chatMessages, mode, systemContext, memoriesContext, tools, maxSteps: 5 });

  const convId = conversationId;
  Promise.resolve(result.text).then(async (fullText: string) => {
    try { await chatStore.addMessage(convId, "assistant", fullText); }
    catch (err) { console.error("[chat] Failed to persist assistant message:", err); }
  }).catch(() => {});

  const response = result.toUIMessageStreamResponse({ sendReasoning: true });
  const headers = new Headers(response.headers);
  headers.set("X-Conversation-Id", convId);
  return new Response(response.body, { status: response.status, headers });
});

// ── Available models ──────────────────────────────────────────────────────

app.get("/workspaces/:workspaceId/chat/models", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) return c.json({ error: memberCheck.error }, memberCheck.status);

  const connected = await resolveConnectedProviders(workspaceId);
  const models: ModelEntry[] = [];
  let defaultModel: string | null = null;
  for (const conn of connected) {
    models.push(...(PROVIDER_MODELS[conn.provider] ?? []));
    if (!defaultModel) defaultModel = conn.defaultModel;
  }
  return c.json({ models, default: defaultModel });
});

export default app;
