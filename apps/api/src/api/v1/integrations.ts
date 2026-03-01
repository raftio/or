import { Hono } from "hono";
import { z } from "zod";
import { query } from "../../db/index.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireWorkspaceAdmin, requireWorkspaceMember } from "../../middleware/workspace-auth.js";
import { testJiraConnection } from "../../adapters/ticket/jira.js";
import { testGitHubConnection } from "../../adapters/ticket/github-issues.js";
import { testNotionConnection } from "../../adapters/document/notion.js";
import { testGitHubCodeConnection, createGitHubCodeProvider } from "../../adapters/code/github.js";
import { CodeIndexer } from "../../services/code-indexer/indexer.js";
import { vectorStore, embeddingProvider } from "../../tools/index.js";

type Env = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

const app = new Hono<Env>();

app.use("*", authMiddleware as never);

// ── Helpers ─────────────────────────────────────────────────────────────

function maskToken(token: string): string {
  if (token.length <= 6) return "••••••";
  return token.slice(0, 3) + "•".repeat(Math.min(token.length - 6, 20)) + token.slice(-3);
}

// ── List integrations for a workspace ───────────────────────────────────

app.get("/workspaces/:id/integrations", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceMember(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const result = await query<{
    id: string;
    provider: string;
    config: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, provider, config, created_at, updated_at
     FROM workspace_integrations
     WHERE workspace_id = $1
     ORDER BY created_at ASC`,
    [workspaceId],
  );

  const integrations = result.rows.map((row) => {
    const safeConfig = { ...row.config };
    if (typeof safeConfig.api_token === "string") {
      safeConfig.api_token = maskToken(safeConfig.api_token);
    }
    if (typeof safeConfig.access_token === "string") {
      safeConfig.access_token = maskToken(safeConfig.access_token);
    }
    return { ...row, config: safeConfig };
  });

  return c.json({ integrations });
});

// ── Upsert Jira configuration ───────────────────────────────────────────

const JiraConfigSchema = z.object({
  base_url: z
    .string()
    .url("Must be a valid URL")
    .refine((u) => u.includes("atlassian.net") || u.startsWith("https://"), {
      message: "Jira Cloud base URL expected (e.g. https://yourteam.atlassian.net)",
    }),
  email: z.string().email("Must be a valid email"),
  api_token: z.string().min(1, "API token is required"),
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

  const config = {
    base_url: parsed.data.base_url.replace(/\/+$/, ""),
    email: parsed.data.email,
    api_token: parsed.data.api_token,
  };

  const result = await query<{
    id: string;
    provider: string;
    created_at: string;
    updated_at: string;
  }>(
    `INSERT INTO workspace_integrations (workspace_id, provider, config)
     VALUES ($1, 'jira', $2::jsonb)
     ON CONFLICT (workspace_id, provider)
     DO UPDATE SET config = $2::jsonb, updated_at = now()
     RETURNING id, provider, created_at, updated_at`,
    [workspaceId, JSON.stringify(config)],
  );

  const row = result.rows[0];
  return c.json({
    integration: {
      ...row,
      config: { ...config, api_token: maskToken(config.api_token) },
    },
  }, 200);
});

// ── Delete (disconnect) Jira ────────────────────────────────────────────

app.delete("/workspaces/:id/integrations/jira", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  await query(
    `DELETE FROM workspace_integrations WHERE workspace_id = $1 AND provider = 'jira'`,
    [workspaceId],
  );

  return c.json({ deleted: true });
});

// ── Test Jira connection ────────────────────────────────────────────────

const TestJiraSchema = z.object({
  base_url: z.string().url(),
  email: z.string().email(),
  api_token: z.string().min(1),
});

app.post("/workspaces/:id/integrations/jira/test", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceMember(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => ({}));
  const parsed = TestJiraSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  try {
    const user = await testJiraConnection(
      parsed.data.base_url,
      parsed.data.email,
      parsed.data.api_token,
    );
    return c.json({ ok: true, user });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection failed";
    return c.json({ ok: false, error: msg }, 400);
  }
});

// ── Upsert GitHub Issues configuration ───────────────────────────────

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

  const result = await query<{
    id: string;
    provider: string;
    created_at: string;
    updated_at: string;
  }>(
    `INSERT INTO workspace_integrations (workspace_id, provider, config)
     VALUES ($1, 'github', $2::jsonb)
     ON CONFLICT (workspace_id, provider)
     DO UPDATE SET config = $2::jsonb, updated_at = now()
     RETURNING id, provider, created_at, updated_at`,
    [workspaceId, JSON.stringify(config)],
  );

  const row = result.rows[0];
  return c.json({
    integration: {
      ...row,
      config: { ...config, access_token: maskToken(config.access_token) },
    },
  }, 200);
});

// ── Delete (disconnect) GitHub Issues ────────────────────────────────

app.delete("/workspaces/:id/integrations/github", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  await query(
    `DELETE FROM workspace_integrations WHERE workspace_id = $1 AND provider = 'github'`,
    [workspaceId],
  );

  return c.json({ deleted: true });
});

// ── Test GitHub connection ───────────────────────────────────────────

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
    const msg = err instanceof Error ? err.message : "Connection failed";
    return c.json({ ok: false, error: msg }, 400);
  }
});

// ── Upsert Notion configuration ──────────────────────────────────────

const NotionConfigSchema = z.object({
  api_token: z.string().min(1, "API token is required"),
});

app.put("/workspaces/:id/integrations/notion", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => ({}));
  const parsed = NotionConfigSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const config = { api_token: parsed.data.api_token };

  const result = await query<{
    id: string;
    provider: string;
    created_at: string;
    updated_at: string;
  }>(
    `INSERT INTO workspace_integrations (workspace_id, provider, config)
     VALUES ($1, 'notion', $2::jsonb)
     ON CONFLICT (workspace_id, provider)
     DO UPDATE SET config = $2::jsonb, updated_at = now()
     RETURNING id, provider, created_at, updated_at`,
    [workspaceId, JSON.stringify(config)],
  );

  const row = result.rows[0];
  return c.json({
    integration: {
      ...row,
      config: { api_token: maskToken(config.api_token) },
    },
  }, 200);
});

// ── Delete (disconnect) Notion ───────────────────────────────────────

app.delete("/workspaces/:id/integrations/notion", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  await query(
    `DELETE FROM workspace_integrations WHERE workspace_id = $1 AND provider = 'notion'`,
    [workspaceId],
  );

  return c.json({ deleted: true });
});

// ── Test Notion connection ───────────────────────────────────────────

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
    const msg = err instanceof Error ? err.message : "Connection failed";
    return c.json({ ok: false, error: msg }, 400);
  }
});

// ── Upsert GitHub Code configuration ─────────────────────────────────

const GitHubCodeConfigSchema = z.object({
  owner: z.string().min(1, "Owner/org is required"),
  repo: z.string().min(1, "Repository name is required"),
  access_token: z.string().min(1, "Access token is required"),
  branch: z.string().default("main"),
});

app.put("/workspaces/:id/integrations/github-code", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => ({}));
  const parsed = GitHubCodeConfigSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const config = {
    owner: parsed.data.owner,
    repo: parsed.data.repo,
    access_token: parsed.data.access_token,
    branch: parsed.data.branch,
  };

  const result = await query<{
    id: string;
    provider: string;
    created_at: string;
    updated_at: string;
  }>(
    `INSERT INTO workspace_integrations (workspace_id, provider, config)
     VALUES ($1, 'github_code', $2::jsonb)
     ON CONFLICT (workspace_id, provider)
     DO UPDATE SET config = $2::jsonb, updated_at = now()
     RETURNING id, provider, created_at, updated_at`,
    [workspaceId, JSON.stringify(config)],
  );

  const row = result.rows[0];
  return c.json({
    integration: {
      ...row,
      config: { ...config, access_token: maskToken(config.access_token) },
    },
  }, 200);
});

// ── Delete (disconnect) GitHub Code ──────────────────────────────────

app.delete("/workspaces/:id/integrations/github-code", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  await query(
    `DELETE FROM workspace_integrations WHERE workspace_id = $1 AND provider = 'github_code'`,
    [workspaceId],
  );

  return c.json({ deleted: true });
});

// ── Test GitHub Code connection ──────────────────────────────────────

app.post("/workspaces/:id/integrations/github-code/test", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceMember(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    access_token: z.string().min(1),
  }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  try {
    const info = await testGitHubCodeConnection(
      parsed.data.owner,
      parsed.data.repo,
      parsed.data.access_token,
    );
    return c.json({ ok: true, repo: info });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection failed";
    return c.json({ ok: false, error: msg }, 400);
  }
});

// ── Trigger GitHub Code indexing ─────────────────────────────────────

app.post("/workspaces/:id/integrations/github-code/index", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  if (!embeddingProvider) {
    return c.json({ error: "Embedding provider not configured (OPENAI_API_KEY missing)" }, 400);
  }

  const configResult = await query<{ config: Record<string, string> }>(
    `SELECT config FROM workspace_integrations
     WHERE workspace_id = $1 AND provider = 'github_code'`,
    [workspaceId],
  );

  if (configResult.rows.length === 0) {
    return c.json({ error: "GitHub Code integration not configured" }, 404);
  }

  const cfg = configResult.rows[0].config;
  const owner = cfg.owner?.trim();
  const repo = cfg.repo?.trim();
  const token = cfg.access_token?.trim();
  const branch = cfg.branch?.trim() || "main";

  if (!owner || !repo || !token) {
    return c.json({ error: "Incomplete GitHub Code configuration" }, 400);
  }

  const repoFullName = `${owner}/${repo}`;
  const codeProvider = createGitHubCodeProvider(owner, repo, token, branch);
  const indexer = new CodeIndexer(codeProvider, vectorStore, embeddingProvider);

  // Fire-and-forget: indexing runs in background
  indexer.indexRepository(workspaceId, repoFullName).catch((err) => {
    console.error(`[code-indexer] ${repoFullName} failed:`, err);
  });

  return c.json({ ok: true, message: "Indexing started", repo: repoFullName });
});

// ── GitHub Code indexing status ──────────────────────────────────────

app.get("/workspaces/:id/integrations/github-code/status", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceMember(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const result = await query<{
    repo: string;
    status: string;
    total_files: number;
    indexed_files: number;
    error: string | null;
    started_at: string | null;
    completed_at: string | null;
  }>(
    `SELECT repo, status, total_files, indexed_files, error, started_at, completed_at
     FROM workspace_code_index_status
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspaceId],
  );

  return c.json({ indexes: result.rows });
});

export default app;
