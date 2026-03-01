import { Hono } from "hono";
import { query, vectorQuery } from "../../db/index.js";
import { authMiddleware } from "../../middleware/auth.js";
import { createGitHubCodeProvider } from "../../adapters/code/github.js";
import { CodeIndexer } from "../../services/code-indexer/indexer.js";
import { vectorStore, embeddingProvider } from "../../tools/index.js";

type Env = {
  Variables: {
    userId: string;
    userEmail: string;
    apiTokenWorkspaceId?: string;
  };
};

const app = new Hono<Env>();

app.use("*", authMiddleware as never);

app.post("/code-index/sync", async (c) => {
  const workspaceId = c.get("apiTokenWorkspaceId");
  if (!workspaceId) {
    return c.json({ error: "Workspace context required. Use API token." }, 400);
  }

  if (!embeddingProvider) {
    return c.json({ error: "Embedding provider not configured (OPENAI_API_KEY missing)" }, 400);
  }

  const result = await query<{
    workspace_id: string;
    config: Record<string, string>;
  }>(
    `SELECT workspace_id, config FROM workspace_integrations
     WHERE workspace_id = $1 AND provider = 'github_code'`,
    [workspaceId],
  );

  if (result.rows.length === 0) {
    return c.json({ triggered: 0, message: "No github_code integration configured" });
  }

  let triggered = 0;
  let skipped = 0;

  for (const row of result.rows) {
    const owner = row.config.owner?.trim();
    const repo = row.config.repo?.trim();
    const token = row.config.access_token?.trim();
    const branch = row.config.branch?.trim() || "main";

    if (!owner || !repo || !token) continue;

    const repoFullName = `${owner}/${repo}`;
    const codeProvider = createGitHubCodeProvider(owner, repo, token, branch);

    if (codeProvider.getHeadSha) {
      const headSha = await codeProvider.getHeadSha();
      if (headSha) {
        const statusRow = await vectorQuery<{ last_commit_sha: string | null }>(
          `SELECT last_commit_sha FROM workspace_code_index_status
           WHERE workspace_id = $1 AND repo = $2 AND status = 'ready'`,
          [row.workspace_id, repoFullName],
        );
        if (statusRow.rows[0]?.last_commit_sha === headSha) {
          skipped++;
          continue;
        }
      }
    }

    const indexer = new CodeIndexer(codeProvider, vectorStore, embeddingProvider);
    const headSha = await codeProvider.getHeadSha?.() ?? undefined;

    indexer.indexRepository(row.workspace_id, repoFullName, headSha).catch((err) => {
      console.error(`[code-index/sync] ${repoFullName} failed:`, err);
    });

    triggered++;
  }

  return c.json({ triggered, skipped });
});

export default app;
