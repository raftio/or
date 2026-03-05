import { Hono } from "hono";
import { z } from "zod";
import { query, vectorQuery } from "../../../db/index.js";
import { authMiddleware } from "../../../middleware/auth.js";
import { requireWorkspaceAdmin, requireWorkspaceMember } from "../../../middleware/workspace-auth.js";
import { testGitLabConnection } from "../../../adapters/ticket/gitlab.js";
import {
  createGitLabCodeProvider,
  listGitLabProjects,
  getGitLabProjectDefaultBranch,
} from "../../../adapters/code/gitlab.js";
import { CodeIndexer } from "../../../services/code-indexer/indexer.js";
import { vectorStore, embeddingProvider } from "../../../tools/index.js";
import { type Env, maskToken, upsertIntegration, deleteIntegration } from "./helpers.js";

const app = new Hono<Env>();
app.use("*", authMiddleware as never);

export function normalizeGitLabCodeConfig(cfg: Record<string, unknown>): {
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

  const result = await upsertIntegration(workspaceId, "gitlab_code", config);
  return c.json({
    integration: {
      ...result.rows[0],
      config: { ...config, access_token: maskToken(config.access_token as string) },
    },
  }, 200);
});

app.delete("/workspaces/:id/integrations/gitlab-code", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const configResult = await query<{ config: Record<string, unknown> }>(
    `SELECT config FROM workspace_integrations WHERE workspace_id = $1 AND provider = 'gitlab_code'`,
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

  await deleteIntegration(workspaceId, "gitlab_code");
  return c.json({ deleted: true });
});

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
    return c.json({ ok: false, error: err instanceof Error ? err.message : "Connection failed" }, 400);
  }
});

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
      `SELECT config FROM workspace_integrations WHERE workspace_id = $1 AND provider = 'gitlab_code'`,
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
    return c.json({ error: err instanceof Error ? err.message : "Failed to list projects" }, 400);
  }
});

app.post("/workspaces/:id/integrations/gitlab-code/index", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");
  const onlyRepo = c.req.query("repo")?.trim();

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  if (!embeddingProvider) {
    return c.json({ error: "Embedding provider not configured (OPENAI_API_KEY missing)" }, 400);
  }

  const configResult = await query<{ config: Record<string, unknown> }>(
    `SELECT config FROM workspace_integrations WHERE workspace_id = $1 AND provider = 'gitlab_code'`,
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

  const targetProjects = onlyRepo ? projects.filter((p) => p === onlyRepo) : projects;
  if (targetProjects.length === 0) {
    return c.json({ error: `Project "${onlyRepo}" not found in configured projects` }, 404);
  }

  const triggered: string[] = [];
  for (const projectId of targetProjects) {
    const branch = await getGitLabProjectDefaultBranch(projectId, token, baseUrl);
    const codeProvider = createGitLabCodeProvider(projectId, token, branch, baseUrl);
    const indexer = new CodeIndexer(codeProvider, vectorStore, embeddingProvider);
    indexer.forceIndexRepository(workspaceId, projectId, undefined).catch((err) => {
      console.error(`[code-indexer] ${projectId} failed:`, err);
    });
    triggered.push(projectId);
  }

  return c.json({ ok: true, message: "Indexing started", repos: triggered });
});

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

export default app;
