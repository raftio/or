import { Hono } from "hono";
import { z } from "zod";
import { query, vectorQuery } from "../../db/index.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireWorkspaceAdmin, requireWorkspaceMember } from "../../middleware/workspace-auth.js";
import { testJiraConnection } from "../../adapters/ticket/jira.js";
import { testGitHubConnection } from "../../adapters/ticket/github-issues.js";
import { testNotionConnection } from "../../adapters/document/notion.js";
import { testGitLabConnection } from "../../adapters/ticket/gitlab.js";
import {
  testGitHubCodeConnection,
  createGitHubCodeProvider,
  listGitHubRepos,
  getRepoDefaultBranch,
} from "../../adapters/code/github.js";
import {
  createGitLabCodeProvider,
  listGitLabProjects,
  getGitLabProjectDefaultBranch,
} from "../../adapters/code/gitlab.js";
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

// ── Upsert GitLab Issues configuration ───────────────────────────────

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

  const result = await query<{
    id: string;
    provider: string;
    created_at: string;
    updated_at: string;
  }>(
    `INSERT INTO workspace_integrations (workspace_id, provider, config)
     VALUES ($1, 'gitlab', $2::jsonb)
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

// ── Delete (disconnect) GitLab Issues ────────────────────────────────

app.delete("/workspaces/:id/integrations/gitlab", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  await query(
    `DELETE FROM workspace_integrations WHERE workspace_id = $1 AND provider = 'gitlab'`,
    [workspaceId],
  );

  return c.json({ deleted: true });
});

// ── Test GitLab connection ───────────────────────────────────────────

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
    const msg = err instanceof Error ? err.message : "Connection failed";
    return c.json({ ok: false, error: msg }, 400);
  }
});

// ── GitLab Code helpers ──────────────────────────────────────────────

function normalizeGitLabCodeConfig(cfg: Record<string, unknown>): {
  group: string;
  projects: string[];
  access_token: string;
  base_url?: string;
} {
  const group = (typeof cfg.group === "string" ? cfg.group : "").trim();
  const access_token = (typeof cfg.access_token === "string" ? cfg.access_token : "").trim();
  const base_url = typeof cfg.base_url === "string" && cfg.base_url.trim() ? cfg.base_url.trim() : undefined;

  let projects: string[];
  if (Array.isArray(cfg.projects)) {
    projects = cfg.projects.filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  } else if (typeof cfg.project_id === "string" && cfg.project_id.trim()) {
    projects = [cfg.project_id.trim()];
  } else {
    projects = [];
  }

  return { group, projects, access_token, base_url };
}

// ── Upsert GitLab Code configuration ─────────────────────────────────

const GitLabCodeConfigSchema = z.object({
  group: z.string().min(1, "Group / namespace is required"),
  projects: z.array(z.string().min(1)).min(1, "At least one project is required"),
  access_token: z.string().min(1, "Access token is required"),
  base_url: z.string().url().optional(),
});

app.put("/workspaces/:id/integrations/gitlab-code", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => ({}));
  const parsed = GitLabCodeConfigSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const config: Record<string, unknown> = {
    group: parsed.data.group,
    projects: parsed.data.projects,
    access_token: parsed.data.access_token,
  };
  if (parsed.data.base_url) config.base_url = parsed.data.base_url.replace(/\/+$/, "");

  const result = await query<{
    id: string;
    provider: string;
    created_at: string;
    updated_at: string;
  }>(
    `INSERT INTO workspace_integrations (workspace_id, provider, config)
     VALUES ($1, 'gitlab_code', $2::jsonb)
     ON CONFLICT (workspace_id, provider)
     DO UPDATE SET config = $2::jsonb, updated_at = now()
     RETURNING id, provider, created_at, updated_at`,
    [workspaceId, JSON.stringify(config)],
  );

  const row = result.rows[0];
  return c.json({
    integration: {
      ...row,
      config: { ...config, access_token: maskToken(config.access_token as string) },
    },
  }, 200);
});

// ── Delete (disconnect) GitLab Code ──────────────────────────────────

app.delete("/workspaces/:id/integrations/gitlab-code", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const configResult = await query<{ config: Record<string, unknown> }>(
    `SELECT config FROM workspace_integrations
     WHERE workspace_id = $1 AND provider = 'gitlab_code'`,
    [workspaceId],
  );

  if (configResult.rows.length > 0) {
    const { projects } = normalizeGitLabCodeConfig(configResult.rows[0].config);
    if (projects.length > 0) {
      await vectorQuery(
        `DELETE FROM workspace_code_chunks WHERE workspace_id = $1 AND repo = ANY($2)`,
        [workspaceId, projects],
      );
      await vectorQuery(
        `DELETE FROM workspace_code_index_status WHERE workspace_id = $1 AND repo = ANY($2)`,
        [workspaceId, projects],
      );
    }
  }

  await query(
    `DELETE FROM workspace_integrations WHERE workspace_id = $1 AND provider = 'gitlab_code'`,
    [workspaceId],
  );

  return c.json({ deleted: true });
});

// ── Test GitLab Code connection ──────────────────────────────────────

app.post("/workspaces/:id/integrations/gitlab-code/test", async (c) => {
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
    const msg = err instanceof Error ? err.message : "Connection failed";
    return c.json({ ok: false, error: msg }, 400);
  }
});

// ── List available GitLab projects for a group ───────────────────────

app.get("/workspaces/:id/integrations/gitlab-code/repos", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceMember(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  let group = c.req.query("group")?.trim();
  let token = c.req.query("access_token")?.trim();
  let baseUrl = c.req.query("base_url")?.trim() || undefined;

  if (!group || !token) {
    const configResult = await query<{ config: Record<string, unknown> }>(
      `SELECT config FROM workspace_integrations
       WHERE workspace_id = $1 AND provider = 'gitlab_code'`,
      [workspaceId],
    );
    if (configResult.rows.length === 0) {
      return c.json({ error: "Provide group and access_token, or connect the integration first" }, 400);
    }
    const cfg = configResult.rows[0].config;
    group = group || (typeof cfg.group === "string" ? cfg.group.trim() : "");
    token = token || (typeof cfg.access_token === "string" ? cfg.access_token.trim() : "");
    baseUrl = baseUrl || (typeof cfg.base_url === "string" ? cfg.base_url.trim() : undefined);
  }

  if (!group || !token) {
    return c.json({ error: "Group and access token are required" }, 400);
  }

  try {
    const projects = await listGitLabProjects(group, token, baseUrl);
    return c.json({ projects });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list projects";
    return c.json({ error: msg }, 400);
  }
});

// ── Trigger GitLab Code indexing ─────────────────────────────────────

app.post("/workspaces/:id/integrations/gitlab-code/index", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");
  const force = c.req.query("force") === "true";

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  if (!embeddingProvider) {
    return c.json({ error: "Embedding provider not configured (OPENAI_API_KEY missing)" }, 400);
  }

  const configResult = await query<{ config: Record<string, unknown> }>(
    `SELECT config FROM workspace_integrations
     WHERE workspace_id = $1 AND provider = 'gitlab_code'`,
    [workspaceId],
  );

  if (configResult.rows.length === 0) {
    return c.json({ error: "GitLab Code integration not configured" }, 404);
  }

  const { projects, access_token: token, base_url: baseUrl } = normalizeGitLabCodeConfig(
    configResult.rows[0].config,
  );

  if (projects.length === 0 || !token) {
    return c.json({ error: "Incomplete GitLab Code configuration" }, 400);
  }

  const triggered: string[] = [];

  for (const projectId of projects) {
    const branch = await getGitLabProjectDefaultBranch(projectId, token, baseUrl);
    const codeProvider = createGitLabCodeProvider(projectId, token, branch, baseUrl);
    const indexer = new CodeIndexer(codeProvider, vectorStore, embeddingProvider);

    indexer.indexRepository(workspaceId, projectId, undefined, force).catch((err) => {
      console.error(`[code-indexer] ${projectId} failed:`, err);
    });
    triggered.push(projectId);
  }

  return c.json({ ok: true, message: "Indexing started", repos: triggered });
});

// ── GitLab Code indexing status ──────────────────────────────────────

app.get("/workspaces/:id/integrations/gitlab-code/status", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceMember(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const result = await vectorQuery<{
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

// ── GitHub Code helpers ──────────────────────────────────────────────

/** Normalise legacy single-repo config to multi-repo format. */
function normalizeGitHubCodeConfig(cfg: Record<string, unknown>): {
  owner: string;
  repos: string[];
  access_token: string;
} {
  const owner = (typeof cfg.owner === "string" ? cfg.owner : "").trim();
  const access_token = (typeof cfg.access_token === "string" ? cfg.access_token : "").trim();

  let repos: string[];
  if (Array.isArray(cfg.repos)) {
    repos = cfg.repos.filter((r): r is string => typeof r === "string" && r.trim().length > 0);
  } else if (typeof cfg.repo === "string" && cfg.repo.trim()) {
    repos = [cfg.repo.trim()];
  } else {
    repos = [];
  }

  return { owner, repos, access_token };
}

// ── Upsert GitHub Code configuration ─────────────────────────────────

const GitHubCodeConfigSchema = z.object({
  owner: z.string().min(1, "Owner/org is required"),
  repos: z.array(z.string().min(1)).min(1, "At least one repository is required"),
  access_token: z.string().min(1, "Access token is required"),
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
    repos: parsed.data.repos,
    access_token: parsed.data.access_token,
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

  const configResult = await query<{ config: Record<string, unknown> }>(
    `SELECT config FROM workspace_integrations
     WHERE workspace_id = $1 AND provider = 'github_code'`,
    [workspaceId],
  );

  if (configResult.rows.length > 0) {
    const { owner, repos } = normalizeGitHubCodeConfig(configResult.rows[0].config);
    const repoFullNames = repos.map((r) => `${owner}/${r}`);
    if (repoFullNames.length > 0) {
      await vectorQuery(
        `DELETE FROM workspace_code_chunks WHERE workspace_id = $1 AND repo = ANY($2)`,
        [workspaceId, repoFullNames],
      );
      await vectorQuery(
        `DELETE FROM workspace_code_index_status WHERE workspace_id = $1 AND repo = ANY($2)`,
        [workspaceId, repoFullNames],
      );
    }
  }

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
    access_token: z.string().min(1),
  }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  try {
    const repos = await listGitHubRepos(parsed.data.owner, parsed.data.access_token);
    return c.json({ ok: true, repoCount: repos.length, owner: parsed.data.owner });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection failed";
    return c.json({ ok: false, error: msg }, 400);
  }
});

// ── List available GitHub repos for an owner ─────────────────────────

app.get("/workspaces/:id/integrations/github-code/repos", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceMember(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  let owner = c.req.query("owner")?.trim();
  let token = c.req.query("access_token")?.trim();

  if (!owner || !token) {
    const configResult = await query<{ config: Record<string, unknown> }>(
      `SELECT config FROM workspace_integrations
       WHERE workspace_id = $1 AND provider = 'github_code'`,
      [workspaceId],
    );
    if (configResult.rows.length === 0) {
      return c.json({ error: "Provide owner and access_token, or connect the integration first" }, 400);
    }
    const cfg = configResult.rows[0].config;
    owner = owner || (typeof cfg.owner === "string" ? cfg.owner.trim() : "");
    token = token || (typeof cfg.access_token === "string" ? cfg.access_token.trim() : "");
  }

  if (!owner || !token) {
    return c.json({ error: "Owner and access token are required" }, 400);
  }

  try {
    const repos = await listGitHubRepos(owner, token);
    return c.json({ repos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list repositories";
    return c.json({ error: msg }, 400);
  }
});

// ── Trigger GitHub Code indexing ─────────────────────────────────────

app.post("/workspaces/:id/integrations/github-code/index", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");
  const force = c.req.query("force") === "true";

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  if (!embeddingProvider) {
    return c.json({ error: "Embedding provider not configured (OPENAI_API_KEY missing)" }, 400);
  }

  const configResult = await query<{ config: Record<string, unknown> }>(
    `SELECT config FROM workspace_integrations
     WHERE workspace_id = $1 AND provider = 'github_code'`,
    [workspaceId],
  );

  if (configResult.rows.length === 0) {
    return c.json({ error: "GitHub Code integration not configured" }, 404);
  }

  const { owner, repos, access_token: token } = normalizeGitHubCodeConfig(
    configResult.rows[0].config,
  );

  if (!owner || repos.length === 0 || !token) {
    return c.json({ error: "Incomplete GitHub Code configuration" }, 400);
  }

  const triggered: string[] = [];

  for (const repo of repos) {
    const repoFullName = `${owner}/${repo}`;
    const branch = await getRepoDefaultBranch(owner, repo, token);
    const codeProvider = createGitHubCodeProvider(owner, repo, token, branch);
    const indexer = new CodeIndexer(codeProvider, vectorStore, embeddingProvider);

    indexer.indexRepository(workspaceId, repoFullName, undefined, force).catch((err) => {
      console.error(`[code-indexer] ${repoFullName} failed:`, err);
    });
    triggered.push(repoFullName);
  }

  return c.json({ ok: true, message: "Indexing started", repos: triggered });
});

// ── GitHub Code indexing status ──────────────────────────────────────

app.get("/workspaces/:id/integrations/github-code/status", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceMember(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const result = await vectorQuery<{
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
