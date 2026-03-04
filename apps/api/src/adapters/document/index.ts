import type { DocumentProvider } from "./contract.js";
import { createStubDocumentProvider } from "./stub.js";
import { createNotionDocumentProvider } from "./notion.js";
import { createConfluenceDocumentProvider } from "./confluence.js";
import {
  getDocumentProvider,
  getNotionApiKey,
  getConfluenceBaseUrl,
  getConfluenceEmail,
  getConfluenceApiToken,
} from "../../config.js";
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
  if (kind === "confluence") {
    const baseUrl = getConfluenceBaseUrl();
    const email = getConfluenceEmail();
    const token = getConfluenceApiToken();
    if (baseUrl && email && token) {
      return createConfluenceDocumentProvider(baseUrl, email, token);
    }
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
      if (row.provider === "confluence") {
        const base_url = row.config.base_url?.trim();
        const email = row.config.email?.trim();
        const api_token = row.config.api_token?.trim();
        if (base_url && email && api_token) {
          return createConfluenceDocumentProvider(base_url, email, api_token);
        }
      }
    }
  } catch {
    // DB unavailable — fall through to global config
  }

  return createDocumentProvider();
}
