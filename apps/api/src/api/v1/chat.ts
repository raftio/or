import { Hono } from "hono";
import { z } from "zod";
import { createChatAgent } from "@orca/agent";
import type { ChatMessage, ContentPart } from "@orca/agent";
import { authMiddleware } from "../../middleware/auth.js";
import { requireWorkspaceMember } from "../../middleware/workspace-auth.js";
import * as chatStore from "../../services/chat-store.js";
import * as chatImageStore from "../../services/chat-image-store.js";
import { buildChatContext } from "../../services/chat-context.js";
import { toolRegistry, memoryProvider } from "../../tools/index.js";
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
  imageIds: z.array(z.string().uuid()).optional(),
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

  const { messages, conversationId: existingConvId, imageIds } = parsed.data;
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

  await chatStore.addMessage(conversationId, lastUserMsg.role, lastUserMsg.content, imageIds);

  const tools = toolRegistry.build({ workspaceId, userId, conversationId });

  const [agent, systemContext, recentMemories] = await Promise.all([
    resolveAgent(workspaceId),
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
        if (img) {
          parts.push({ type: "image", image: img.data });
        }
      }
      parts.push({ type: "text", text: m.content });
      chatMessages.push({ role: m.role, content: parts });
    } else {
      chatMessages.push({ role: m.role, content: m.content });
    }
  }

  const result = await agent.chat({
    messages: chatMessages,
    systemContext,
    memoriesContext,
    tools,
    maxSteps: 5,
  });

  const convId = conversationId;
  Promise.resolve(result.text).then(async (fullText: string) => {
    try {
      await chatStore.addMessage(convId, "assistant", fullText);
    } catch (err) {
      console.error("[chat] Failed to persist assistant message:", err);
    }
  }).catch(() => {});

  const response = result.toUIMessageStreamResponse();

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

// ── Image upload & serve ──────────────────────────────────────────────────

app.post("/workspaces/:workspaceId/chat/images", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const body = await c.req.parseBody();
  const file = body["file"];

  if (!(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  const validation = chatImageStore.validateImage(file.type, file.size);
  if (!validation.ok) {
    return c.json({ error: validation.error }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const meta = await chatImageStore.saveImage(
    workspaceId,
    userId,
    file.name || "image",
    file.type,
    buffer,
  );

  return c.json({
    id: meta.id,
    url: `/v1/workspaces/${workspaceId}/chat/images/${meta.id}`,
    filename: meta.filename,
    contentType: meta.content_type,
    size: meta.size_bytes,
  });
});

export default app;

// Public image serve (no auth — UUID is unguessable)
export const chatImages = new Hono();

chatImages.get("/workspaces/:workspaceId/chat/images/:imageId", async (c) => {
  const workspaceId = c.req.param("workspaceId");
  const imageId = c.req.param("imageId");

  const image = await chatImageStore.getImage(imageId);
  if (!image || image.workspace_id !== workspaceId) {
    return c.json({ error: "Image not found" }, 404);
  }

  return new Response(image.data, {
    headers: {
      "Content-Type": image.content_type,
      "Content-Length": String(image.size_bytes),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
