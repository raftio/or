import { Hono } from "hono";
import { authMiddleware } from "../../../middleware/auth.js";
import { requireWorkspaceMember } from "../../../middleware/workspace-auth.js";
import * as chatStore from "../../../services/chat-store.js";

type Env = {
  Variables: {
    userId: string;
    userEmail: string;
    apiTokenWorkspaceId?: string;
  };
};

const app = new Hono<Env>();

app.use("*", authMiddleware as never);

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
