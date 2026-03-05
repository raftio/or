import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../../middleware/auth.js";
import { requireWorkspaceAdmin, requireWorkspaceMember } from "../../../middleware/workspace-auth.js";
import { testNotionConnection } from "../../../adapters/document/notion.js";
import { type Env, maskToken, upsertIntegration, deleteIntegration } from "./helpers.js";

const app = new Hono<Env>();
app.use("*", authMiddleware as never);

app.put("/workspaces/:id/integrations/notion", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ api_token: z.string().min(1, "API token is required") }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const config = { api_token: parsed.data.api_token };
  const result = await upsertIntegration(workspaceId, "notion", config);
  return c.json({
    integration: {
      ...result.rows[0],
      config: { api_token: maskToken(config.api_token) },
    },
  }, 200);
});

app.delete("/workspaces/:id/integrations/notion", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  await deleteIntegration(workspaceId, "notion");
  return c.json({ deleted: true });
});

app.post("/workspaces/:id/integrations/notion/test", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceMember(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ api_token: z.string().min(1) }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  try {
    const bot = await testNotionConnection(parsed.data.api_token);
    return c.json({ ok: true, bot });
  } catch (err) {
    return c.json({ ok: false, error: err instanceof Error ? err.message : "Connection failed" }, 400);
  }
});

export default app;
