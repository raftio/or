import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../../middleware/auth.js";
import { requireWorkspaceAdmin, requireWorkspaceMember } from "../../../middleware/workspace-auth.js";
import { testGitHubConnection } from "../../../adapters/ticket/github-issues.js";
import { type Env, maskToken, upsertIntegration, deleteIntegration } from "./helpers.js";

const app = new Hono<Env>();
app.use("*", authMiddleware as never);

const GitHubConfigSchema = z.object({
  owner: z.string().min(1, "Owner/org is required"),
  repo: z.string().min(1, "Repository name is required"),
  access_token: z.string().min(1, "Access token is required"),
});

app.put("/workspaces/:id/integrations/github", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => ({}));
  const parsed = GitHubConfigSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const config = {
    owner: parsed.data.owner,
    repo: parsed.data.repo,
    access_token: parsed.data.access_token,
  };

  const result = await upsertIntegration(workspaceId, "github", config);
  return c.json({
    integration: {
      ...result.rows[0],
      config: { ...config, access_token: maskToken(config.access_token) },
    },
  }, 200);
});

app.delete("/workspaces/:id/integrations/github", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  await deleteIntegration(workspaceId, "github");
  return c.json({ deleted: true });
});

app.post("/workspaces/:id/integrations/github/test", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceMember(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ access_token: z.string().min(1) }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  try {
    const user = await testGitHubConnection(parsed.data.access_token);
    return c.json({ ok: true, user });
  } catch (err) {
    return c.json({ ok: false, error: err instanceof Error ? err.message : "Connection failed" }, 400);
  }
});

export default app;
