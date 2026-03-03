import type { TicketProvider } from "./contract.js";
import { createLinearTicketProvider } from "./linear.js";
import { createJiraTicketProvider } from "./jira.js";
import { createGitHubIssuesProvider } from "./github-issues.js";
import { createGitLabIssuesProvider } from "./gitlab.js";
import { createStubTicketProvider } from "./stub.js";
import { getTicketProvider, getLinearApiKey } from "../../config.js";
import { query } from "../../db/index.js";

export type { TicketProvider } from "./contract.js";
export type { TicketDto, ListTicketsQuery, AcceptanceCriterionDto, CreateTicketInput } from "./types.js";

/** Global fallback using env vars (backwards-compatible). */
export function createTicketProvider(): TicketProvider {
  const kind = getTicketProvider();
  if (kind === "linear") {
    const key = getLinearApiKey();
    if (key) return createLinearTicketProvider(key);
  }
  return createStubTicketProvider();
}

/** Per-workspace provider: reads config from workspace_integrations, falls back to global. */
export async function createTicketProviderForWorkspace(
  workspaceId: string,
): Promise<TicketProvider> {
  try {
    const result = await query<{ provider: string; config: Record<string, string> }>(
      `SELECT provider, config FROM workspace_integrations WHERE workspace_id = $1`,
      [workspaceId],
    );

    for (const row of result.rows) {
      if (row.provider === "jira") {
        const base_url = row.config.base_url?.trim();
        const email = row.config.email?.trim();
        const api_token = row.config.api_token?.trim();
        if (base_url && email && api_token) {
          return createJiraTicketProvider(base_url, email, api_token);
        }
      }
      if (row.provider === "linear") {
        const api_key = row.config.api_key?.trim();
        if (api_key) return createLinearTicketProvider(api_key);
      }
      if (row.provider === "github") {
        const owner = row.config.owner?.trim();
        const repo = row.config.repo?.trim();
        const access_token = row.config.access_token?.trim();
        if (owner && repo && access_token) {
          return createGitHubIssuesProvider(owner, repo, access_token);
        }
      }
      if (row.provider === "gitlab") {
        const project_id = row.config.project_id?.trim();
        const access_token = row.config.access_token?.trim();
        if (project_id && access_token) {
          return createGitLabIssuesProvider(project_id, access_token);
        }
      }
    }
  } catch {
    // DB unavailable — fall through to global config
  }

  return createTicketProvider();
}
