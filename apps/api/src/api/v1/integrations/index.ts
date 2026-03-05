import { Hono } from "hono";
import { query } from "../../../db/index.js";
import { authMiddleware } from "../../../middleware/auth.js";
import { requireWorkspaceMember } from "../../../middleware/workspace-auth.js";
import { maskToken, type Env } from "./helpers.js";
import jira from "./jira.js";
import github from "./github.js";
import gitlab from "./gitlab.js";
import githubCode from "./github-code.js";
import gitlabCode from "./gitlab-code.js";
import notion from "./notion.js";
import confluence from "./confluence.js";

const app = new Hono<Env>();
app.use("*", authMiddleware as never);

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
    if (typeof safeConfig.api_token === "string") safeConfig.api_token = maskToken(safeConfig.api_token);
    if (typeof safeConfig.access_token === "string") safeConfig.access_token = maskToken(safeConfig.access_token);
    return { ...row, config: safeConfig };
  });

  return c.json({ integrations });
});

app.route("/", jira);
app.route("/", github);
app.route("/", gitlab);
app.route("/", githubCode);
app.route("/", gitlabCode);
app.route("/", notion);
app.route("/", confluence);

export default app;
