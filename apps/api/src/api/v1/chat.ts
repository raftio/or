import { Hono } from "hono";
import { z } from "zod";
import { createChatAgent } from "@orca/agent";
import type { ChatMessage } from "@orca/agent";
import { authMiddleware } from "../../middleware/auth.js";
import { requireWorkspaceMember } from "../../middleware/workspace-auth.js";
import * as chatStore from "../../services/chat-store.js";
import { buildChatContext } from "../../services/chat-context.js";
import {
  getAiChatProvider,
  getAiChatModel,
  getOpenAiApiKey,
  getAnthropicApiKey,
} from "../../config.js";
import { query } from "../../db/index.js";

type Env = {
  Variables: {
    userId: string;
    userEmail: string;
    apiTokenWorkspaceId?: string;
  };
};

const app = new Hono<Env>();

app.use("*", authMiddleware as never);

const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().min(1),
    }),
  ).min(1),
  conversationId: z.string().uuid().optional(),
});

async function resolveAgent(workspaceId: string) {
  try {
    const result = await query<{ provider: string; config: Record<string, string> }>(
      `SELECT provider, config FROM workspace_integrations WHERE workspace_id = $1`,
      [workspaceId],
    );

    for (const row of result.rows) {
      if (row.provider === "openai" && row.config.api_key?.trim()) {
        return createChatAgent({
          provider: "openai",
          apiKey: row.config.api_key.trim(),
          modelName: row.config.model?.trim() || "gpt-4o-mini",
        });
      }
      if (row.provider === "anthropic" && row.config.api_key?.trim()) {
        return createChatAgent({
          provider: "anthropic",
          apiKey: row.config.api_key.trim(),
          modelName: row.config.model?.trim() || "claude-sonnet-4-20250514",
        });
      }
    }
  } catch {
    // Fall through to env-based config
  }

  const provider = getAiChatProvider();
  const modelName = getAiChatModel();
  const apiKey = provider === "openai"
    ? getOpenAiApiKey()
    : provider === "anthropic"
      ? getAnthropicApiKey()
      : undefined;

  return createChatAgent({ provider, modelName, apiKey });
}

// ── Streaming chat endpoint ───────────────────────────────────────────────

app.post("/workspaces/:workspaceId/chat", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { messages, conversationId: existingConvId } = parsed.data;
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    return c.json({ error: "No user message found" }, 400);
  }

  let conversationId = existingConvId;

  if (conversationId) {
    const conv = await chatStore.getConversation(conversationId);
    if (!conv || conv.workspace_id !== workspaceId || conv.user_id !== userId) {
      return c.json({ error: "Conversation not found" }, 404);
    }
  } else {
    const title = lastUserMsg.content.slice(0, 100);
    const conv = await chatStore.createConversation(workspaceId, userId, title);
    conversationId = conv.id;
  }

  await chatStore.addMessage(conversationId, lastUserMsg.role, lastUserMsg.content);

  const [agent, systemContext] = await Promise.all([
    resolveAgent(workspaceId),
    buildChatContext(workspaceId),
  ]);

  const chatMessages: ChatMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const result = await agent.chat({ messages: chatMessages, systemContext });

  const convId = conversationId;
  result.text.then(async (fullText: string) => {
    try {
      await chatStore.addMessage(convId, "assistant", fullText);
    } catch (err) {
      console.error("[chat] Failed to persist assistant message:", err);
    }
  }).catch(() => {});

  const response = result.toTextStreamResponse();

  const headers = new Headers(response.headers);
  headers.set("X-Conversation-Id", convId);

  return new Response(response.body, {
    status: response.status,
    headers,
  });
});

// ── Conversation CRUD ─────────────────────────────────────────────────────

app.get("/workspaces/:workspaceId/chat/conversations", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const limit = Number(c.req.query("limit")) || 50;
  const offset = Number(c.req.query("offset")) || 0;
  const result = await chatStore.listConversations(workspaceId, userId, limit, offset);
  return c.json(result);
});

app.get("/workspaces/:workspaceId/chat/conversations/:id", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");
  const convId = c.req.param("id");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const conv = await chatStore.getConversation(convId);
  if (!conv || conv.workspace_id !== workspaceId || conv.user_id !== userId) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  const messages = await chatStore.getMessages(convId);
  return c.json({ conversation: conv, messages });
});

app.delete("/workspaces/:workspaceId/chat/conversations/:id", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");
  const convId = c.req.param("id");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const conv = await chatStore.getConversation(convId);
  if (!conv || conv.workspace_id !== workspaceId || conv.user_id !== userId) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  await chatStore.deleteConversation(convId);
  return c.json({ ok: true });
});

export default app;
