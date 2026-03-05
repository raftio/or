import { query } from "../../../db/index.js";

export type Env = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

export function maskToken(token: string): string {
  if (token.length <= 6) return "••••••";
  return token.slice(0, 3) + "•".repeat(Math.min(token.length - 6, 20)) + token.slice(-3);
}

export async function upsertIntegration(
  workspaceId: string,
  provider: string,
  config: Record<string, unknown>,
) {
  return query<{ id: string; provider: string; created_at: string; updated_at: string }>(
    `INSERT INTO workspace_integrations (workspace_id, provider, config)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (workspace_id, provider)
     DO UPDATE SET config = $3::jsonb, updated_at = now()
     RETURNING id, provider, created_at, updated_at`,
    [workspaceId, provider, JSON.stringify(config)],
  );
}

export async function deleteIntegration(workspaceId: string, provider: string) {
  return query(
    `DELETE FROM workspace_integrations WHERE workspace_id = $1 AND provider = $2`,
    [workspaceId, provider],
  );
}
