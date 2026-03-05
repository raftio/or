import { Hono } from "hono";
import { z } from "zod";
import { query, vectorQuery } from "../../../db/index.js";
import { authMiddleware } from "../../../middleware/auth.js";
import { requireWorkspaceAdmin, requireWorkspaceMember } from "../../../middleware/workspace-auth.js";
import {
  createGitHubCodeProvider,
  listGitHubRepos,
  getRepoDefaultBranch,
} from "../../../adapters/code/github.js";
import { CodeIndexer } from "../../../services/code-indexer/indexer.js";
import { vectorStore, embeddingProvider } from "../../../tools/index.js";
import { type Env, maskToken, upsertIntegration, deleteIntegration } from "./helpers.js";

const app = new Hono<Env>();
app.use("*", authMiddleware as never);

/** Normalise legacy single-repo config to multi-repo format. */
export function normalizeGitHubCodeConfig(cfg: Record<string, unknown>): {
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

  const result = await upsertIntegration(workspaceId, "github_code", config);
  return c.json({
    integration: {
      ...result.rows[0],
      config: { ...config, access_token: maskToken(config.access_token) },
    },
  }, 200);
});

app.delete("/workspaces/:id/integrations/github-code", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const configResult = await query<{ config: Record<string, unknown> }>(
    `SELECT config FROM workspace_integrations WHERE workspace_id = $1 AND provider = 'github_code'`,
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

  await deleteIntegration(workspaceId, "github_code");
  return c.json({ deleted: true });
});

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
    return c.json({ ok: false, error: err instanceof Error ? err.message : "Connection failed" }, 400);
  }
});

app.get("/workspaces/:id/integrations/github-code/repos", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceMember(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  let owner = c.req.query("owner")?.trim();
  let token = c.req.query("access_token")?.trim();

  if (!owner || !token) {
    const configResult = await query<{ config: Record<string, unknown> }>(
      `SELECT config FROM workspace_integrations WHERE workspace_id = $1 AND provider = 'github_code'`,
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
    return c.json({ error: err instanceof Error ? err.message : "Failed to list repositories" }, 400);
  }
});

app.post("/workspaces/:id/integrations/github-code/index", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");
  const onlyRepo = c.req.query("repo")?.trim();

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  if (!embeddingProvider) {
    return c.json({ error: "Embedding provider not configured (OPENAI_API_KEY missing)" }, 400);
  }

  const configResult = await query<{ config: Record<string, unknown> }>(
    `SELECT config FROM workspace_integrations WHERE workspace_id = $1 AND provider = 'github_code'`,
    [workspaceId],
  );
  if (configResult.rows.length === 0) {
    return c.json({ error: "GitHub Code integration not configured" }, 404);
  }

  const { owner, repos, access_token: token } = normalizeGitHubCodeConfig(configResult.rows[0].config);
  if (!owner || repos.length === 0 || !token) {
    return c.json({ error: "Incomplete GitHub Code configuration" }, 400);
  }

  const targetRepos = onlyRepo
    ? repos.filter((r) => `${owner}/${r}` === onlyRepo || r === onlyRepo)
    : repos;

  if (targetRepos.length === 0) {
    return c.json({ error: `Repository "${onlyRepo}" not found in configured repos` }, 404);
  }

  const triggered: string[] = [];
  for (const repo of targetRepos) {
    const repoFullName = `${owner}/${repo}`;
    const branch = await getRepoDefaultBranch(owner, repo, token);
    const codeProvider = createGitHubCodeProvider(owner, repo, token, branch);
    const indexer = new CodeIndexer(codeProvider, vectorStore, embeddingProvider);
    indexer.forceIndexRepository(workspaceId, repoFullName, undefined).catch((err) => {
      console.error(`[code-indexer] ${repoFullName} failed:`, err);
    });
    triggered.push(repoFullName);
  }

  return c.json({ ok: true, message: "Indexing started", repos: triggered });
});

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
