import { Hono } from "hono";
import { z } from "zod";
import { query } from "../../../db/index.js";
import { authMiddleware } from "../../../middleware/auth.js";
import { requireWorkspaceAdmin, requireWorkspaceMember } from "../../../middleware/workspace-auth.js";
import { testJiraConnection, listJiraProjects } from "../../../adapters/ticket/jira.js";
import { type Env, maskToken, upsertIntegration, deleteIntegration } from "./helpers.js";

const app = new Hono<Env>();
app.use("*", authMiddleware as never);

const JiraConfigSchema = z.object({
  base_url: z
    .string()
    .url("Must be a valid URL")
    .refine((u) => u.includes("atlassian.net") || u.startsWith("https://"), {
      message: "Jira Cloud base URL expected (e.g. https://yourteam.atlassian.net)",
    }),
  email: z.string().email("Must be a valid email"),
  api_token: z.string().min(1, "API token is required"),
  project_key: z.string().optional(),
});

app.put("/workspaces/:id/integrations/jira", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => ({}));
  const parsed = JiraConfigSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const config: Record<string, string> = {
    base_url: parsed.data.base_url.replace(/\/+$/, ""),
    email: parsed.data.email,
    api_token: parsed.data.api_token,
  };
  if (parsed.data.project_key) config.project_key = parsed.data.project_key;

  const result = await upsertIntegration(workspaceId, "jira", config);
  return c.json({
    integration: {
      ...result.rows[0],
      config: { ...config, api_token: maskToken(config.api_token) },
    },
  }, 200);
});

app.delete("/workspaces/:id/integrations/jira", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  await deleteIntegration(workspaceId, "jira");
  return c.json({ deleted: true });
});

app.post("/workspaces/:id/integrations/jira/test", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceMember(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({
    base_url: z.string().url(),
    email: z.string().email(),
    api_token: z.string().min(1),
  }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  try {
    const user = await testJiraConnection(parsed.data.base_url, parsed.data.email, parsed.data.api_token);
    return c.json({ ok: true, user });
  } catch (err) {
    return c.json({ ok: false, error: err instanceof Error ? err.message : "Connection failed" }, 400);
  }
});

app.get("/workspaces/:id/integrations/jira/projects", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceMember(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  let baseUrl = c.req.query("base_url")?.trim();
  let email = c.req.query("email")?.trim();
  let apiToken = c.req.query("api_token")?.trim();

  if (!baseUrl || !email || !apiToken) {
    const configResult = await query<{ config: Record<string, unknown> }>(
      `SELECT config FROM workspace_integrations WHERE workspace_id = $1 AND provider = 'jira'`,
      [workspaceId],
    );
    if (configResult.rows.length > 0) {
      const cfg = configResult.rows[0].config;
      baseUrl = baseUrl || (typeof cfg.base_url === "string" ? cfg.base_url.trim() : "");
      email = email || (typeof cfg.email === "string" ? cfg.email.trim() : "");
      apiToken = apiToken || (typeof cfg.api_token === "string" ? cfg.api_token.trim() : "");
    }
  }

  if (!baseUrl || !email || !apiToken) {
    return c.json({ error: "Credentials required — provide base_url, email, api_token or connect the integration first" }, 400);
  }

  try {
    const projects = await listJiraProjects(baseUrl, email, apiToken);
    return c.json({ projects });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to list projects" }, 400);
  }
});

export default app;
