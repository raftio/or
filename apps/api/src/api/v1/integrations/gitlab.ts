import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../../middleware/auth.js";
import { requireWorkspaceAdmin, requireWorkspaceMember } from "../../../middleware/workspace-auth.js";
import { testGitLabConnection } from "../../../adapters/ticket/gitlab.js";
import { type Env, maskToken, upsertIntegration, deleteIntegration } from "./helpers.js";

const app = new Hono<Env>();
app.use("*", authMiddleware as never);

const GitLabIssuesConfigSchema = z.object({
  project_id: z.string().min(1, "Project ID is required"),
  access_token: z.string().min(1, "Access token is required"),
  base_url: z.string().url().optional(),
});

app.put("/workspaces/:id/integrations/gitlab", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => ({}));
  const parsed = GitLabIssuesConfigSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const config: Record<string, string> = {
    project_id: parsed.data.project_id,
    access_token: parsed.data.access_token,
  };
  if (parsed.data.base_url) config.base_url = parsed.data.base_url.replace(/\/+$/, "");

  const result = await upsertIntegration(workspaceId, "gitlab", config);
  return c.json({
    integration: {
      ...result.rows[0],
      config: { ...config, access_token: maskToken(config.access_token) },
    },
  }, 200);
});

app.delete("/workspaces/:id/integrations/gitlab", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  await deleteIntegration(workspaceId, "gitlab");
  return c.json({ deleted: true });
});

app.post("/workspaces/:id/integrations/gitlab/test", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceMember(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({
    access_token: z.string().min(1),
    base_url: z.string().url().optional(),
  }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  try {
    const user = await testGitLabConnection(parsed.data.access_token, parsed.data.base_url);
    return c.json({ ok: true, user });
  } catch (err) {
    return c.json({ ok: false, error: err instanceof Error ? err.message : "Connection failed" }, 400);
  }
});

export default app;
