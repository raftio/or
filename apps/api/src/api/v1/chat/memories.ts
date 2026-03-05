import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../../middleware/auth.js";
import { requireWorkspaceMember } from "../../../middleware/workspace-auth.js";
import { memoryProvider } from "../../../tools/index.js";

type Env = {
  Variables: {
    userId: string;
    userEmail: string;
    apiTokenWorkspaceId?: string;
  };
};

const app = new Hono<Env>();

app.use("*", authMiddleware as never);

const CreateMemorySchema = z.object({
  content: z.string().min(1),
  category: z.enum(["decision", "preference", "context", "summary"]).default("context"),
});

const UpdateMemorySchema = z.object({
  content: z.string().min(1),
});

app.get("/workspaces/:workspaceId/chat/memories", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const limit = Number(c.req.query("limit")) || 50;
  const memories = await memoryProvider.getRecent(workspaceId, userId, limit);
  return c.json({ memories });
});

app.post("/workspaces/:workspaceId/chat/memories", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateMemorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const memory = await memoryProvider.save({
    workspaceId,
    userId,
    category: parsed.data.category,
    content: parsed.data.content,
  });
  return c.json({ memory }, 201);
});

app.patch("/workspaces/:workspaceId/chat/memories/:memoryId", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");
  const memoryId = c.req.param("memoryId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateMemorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const memory = await memoryProvider.update(memoryId, parsed.data.content);
  if (!memory || memory.workspaceId !== workspaceId || memory.userId !== userId) {
    return c.json({ error: "Memory not found" }, 404);
  }
  return c.json({ memory });
});

app.delete("/workspaces/:workspaceId/chat/memories/:memoryId", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");
  const memoryId = c.req.param("memoryId");

  const memberCheck = await requireWorkspaceMember(workspaceId, userId);
  if (!memberCheck.ok) {
    return c.json({ error: memberCheck.error }, memberCheck.status);
  }

  const deleted = await memoryProvider.delete(memoryId);
  if (!deleted) {
    return c.json({ error: "Memory not found" }, 404);
  }
  return c.json({ ok: true });
});

export default app;
