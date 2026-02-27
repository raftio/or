import type { DocumentProvider } from "./contract.js";
import { createStubDocumentProvider } from "./stub.js";
import { createNotionDocumentProvider } from "./notion.js";
import { getDocumentProvider, getNotionApiKey } from "../../config.js";
import { query } from "../../db/index.js";

export type { DocumentProvider } from "./contract.js";
export type { SpecDocumentDto, SpecSectionDto, SpecAcceptanceCriterionDto } from "./types.js";

/** Global fallback using env vars. */
export function createDocumentProvider(): DocumentProvider {
  const kind = getDocumentProvider();
  if (kind === "notion") {
    const key = getNotionApiKey();
    if (key) return createNotionDocumentProvider(key);
  }
  return createStubDocumentProvider();
}

/** Per-workspace provider: reads config from workspace_integrations, falls back to global. */
export async function createDocumentProviderForWorkspace(
  workspaceId: string,
): Promise<DocumentProvider> {
  try {
    const result = await query<{ provider: string; config: Record<string, string> }>(
      `SELECT provider, config FROM workspace_integrations WHERE workspace_id = $1`,
      [workspaceId],
    );

    for (const row of result.rows) {
      if (row.provider === "notion") {
        const api_token = row.config.api_token?.trim();
        if (api_token) return createNotionDocumentProvider(api_token);
      }
    }
  } catch {
    // DB unavailable — fall through to global config
  }

  return createDocumentProvider();
}
