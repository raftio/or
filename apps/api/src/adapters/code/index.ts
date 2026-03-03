import type { CodeProvider } from "./contract.js";
import { createStubCodeProvider } from "./stub.js";
import { createGitHubCodeProvider, getRepoDefaultBranch } from "./github.js";
import { query } from "../../db/index.js";

export type { CodeProvider } from "./contract.js";
export type { CodeFileDto, RepoTreeEntry, ListFilesOptions } from "./types.js";

/** Per-workspace provider: reads config from workspace_integrations, returns the first repo's provider. */
export async function createCodeProviderForWorkspace(
  workspaceId: string,
): Promise<CodeProvider> {
  try {
    const result = await query<{ provider: string; config: Record<string, unknown> }>(
      `SELECT provider, config FROM workspace_integrations WHERE workspace_id = $1`,
      [workspaceId],
    );

    for (const row of result.rows) {
      if (row.provider === "github_code") {
        const owner = (typeof row.config.owner === "string" ? row.config.owner : "").trim();
        const token = (typeof row.config.access_token === "string" ? row.config.access_token : "").trim();

        let repo: string | undefined;
        if (Array.isArray(row.config.repos) && row.config.repos.length > 0) {
          repo = String(row.config.repos[0]).trim();
        } else if (typeof row.config.repo === "string") {
          repo = row.config.repo.trim();
        }

        if (owner && repo && token) {
          const branch = await getRepoDefaultBranch(owner, repo, token);
          return createGitHubCodeProvider(owner, repo, token, branch);
        }
      }
    }
  } catch {
    // DB unavailable — fall through to stub
  }

  return createStubCodeProvider();
}
