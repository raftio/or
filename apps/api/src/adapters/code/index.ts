import type { CodeProvider } from "./contract.js";
import { createStubCodeProvider } from "./stub.js";
import { createGitHubCodeProvider } from "./github.js";
import { query } from "../../db/index.js";

export type { CodeProvider } from "./contract.js";
export type { CodeFileDto, RepoTreeEntry, ListFilesOptions } from "./types.js";

/** Per-workspace provider: reads config from workspace_integrations, falls back to stub. */
export async function createCodeProviderForWorkspace(
  workspaceId: string,
): Promise<CodeProvider> {
  try {
    const result = await query<{ provider: string; config: Record<string, string> }>(
      `SELECT provider, config FROM workspace_integrations WHERE workspace_id = $1`,
      [workspaceId],
    );

    for (const row of result.rows) {
      if (row.provider === "github_code") {
        const owner = row.config.owner?.trim();
        const repo = row.config.repo?.trim();
        const token = row.config.access_token?.trim();
        const branch = row.config.branch?.trim() || "main";
        if (owner && repo && token) {
          return createGitHubCodeProvider(owner, repo, token, branch);
        }
      }
    }
  } catch {
    // DB unavailable — fall through to stub
  }

  return createStubCodeProvider();
}
