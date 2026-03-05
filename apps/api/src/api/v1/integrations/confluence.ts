import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../../middleware/auth.js";
import { requireWorkspaceAdmin, requireWorkspaceMember } from "../../../middleware/workspace-auth.js";
import { testConfluenceConnection } from "../../../adapters/document/confluence.js";
import { type Env, maskToken, upsertIntegration, deleteIntegration } from "./helpers.js";

const app = new Hono<Env>();
app.use("*", authMiddleware as never);

const ConfluenceConfigSchema = z.object({
  base_url: z
    .string()
    .url("Must be a valid URL")
    .refine((u) => u.includes("atlassian.net") || u.startsWith("https://"), {
      message: "Confluence Cloud base URL expected (e.g. https://yourteam.atlassian.net/wiki)",
    }),
  email: z.string().email("Must be a valid email"),
  api_token: z.string().min(1, "API token is required"),
});

app.put("/workspaces/:id/integrations/confluence", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => ({}));
  const parsed = ConfluenceConfigSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const config: Record<string, string> = {
    base_url: parsed.data.base_url.replace(/\/+$/, ""),
    email: parsed.data.email,
    api_token: parsed.data.api_token,
  };

  const result = await upsertIntegration(workspaceId, "confluence", config);
  return c.json({
    integration: {
      ...result.rows[0],
      config: { ...config, api_token: maskToken(config.api_token) },
    },
  }, 200);
});

app.delete("/workspaces/:id/integrations/confluence", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  await deleteIntegration(workspaceId, "confluence");
  return c.json({ deleted: true });
});

app.post("/workspaces/:id/integrations/confluence/test", async (c) => {
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
    const user = await testConfluenceConnection(
      parsed.data.base_url,
      parsed.data.email,
      parsed.data.api_token,
    );
    return c.json({ ok: true, user });
  } catch (err) {
    return c.json({ ok: false, error: err instanceof Error ? err.message : "Connection failed" }, 400);
  }
});

export default app;
