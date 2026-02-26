/**
 * App config from env
 */
export function getTicketProvider(): "stub" | "linear" | "jira" {
  const v = process.env.TICKET_PROVIDER?.toLowerCase();
  if (v === "linear" || v === "jira") return v;
  return "stub";
}

export function getLinearApiKey(): string | undefined {
  return process.env.LINEAR_API_KEY;
}

export function getJiraBaseUrl(): string | undefined {
  return process.env.JIRA_BASE_URL?.replace(/\/$/, "");
}

export function getJiraEmail(): string | undefined {
  return process.env.JIRA_EMAIL;
}

export function getJiraApiToken(): string | undefined {
  return process.env.JIRA_API_TOKEN;
}

export function getDocumentProvider(): "stub" | "confluence" | "notion" {
  const v = process.env.DOCUMENT_PROVIDER?.toLowerCase();
  if (v === "confluence" || v === "notion") return v;
  return "stub";
}

export function getConfluenceBaseUrl(): string | undefined {
  return process.env.CONFLUENCE_BASE_URL?.replace(/\/$/, "");
}

export function getConfluenceEmail(): string | undefined {
  return process.env.CONFLUENCE_EMAIL;
}

export function getConfluenceApiToken(): string | undefined {
  return process.env.CONFLUENCE_API_TOKEN;
}

export function getContextCacheTtlMinutes(): number {
  const v = process.env.CONTEXT_CACHE_TTL_MINUTES;
  if (v === undefined) return 5;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

export function getGitProvider(): "stub" | "github" {
  const v = process.env.GIT_PROVIDER?.toLowerCase();
  if (v === "github") return "github";
  return "stub";
}

export function getGitHubToken(): string | undefined {
  return process.env.GITHUB_TOKEN;
}

/** Optional. If set, POST /v1/evidence requires X-Orqestra-Webhook-Secret or Authorization: Bearer to match. */
export function getCiWebhookSecret(): string | undefined {
  return process.env.CI_WEBHOOK_SECRET;
}

/** Secret for verifying GitHub webhook X-Hub-Signature-256. */
export function getGitHubWebhookSecret(): string | undefined {
  return process.env.GITHUB_WEBHOOK_SECRET;
}

/** When true, /v1/* requires Authorization: Bearer <key> or X-API-Key. */
export function getRequireAuth(): boolean {
  return process.env.REQUIRE_AUTH === "true" || process.env.REQUIRE_AUTH === "1";
}

export interface ApiKeyEntry {
  key: string;
  tenantId: string;
}

/** Parse ORQESTRA_API_KEYS (comma-separated "key" or "key:tenant_id"). */
export function getApiKeys(): ApiKeyEntry[] {
  const raw = process.env.ORQESTRA_API_KEYS;
  if (!raw?.trim()) return [];
  return raw.split(",").map((s) => {
    const [key, tenantId] = s.trim().split(":");
    return { key: key!.trim(), tenantId: (tenantId ?? "default").trim() };
  });
}

export function getNotificationWebhookUrl(): string | undefined {
  return process.env.NOTIFICATION_WEBHOOK_URL;
}

export function getSlackWebhookUrl(): string | undefined {
  return process.env.SLACK_WEBHOOK_URL;
}

export function getNotionApiKey(): string | undefined {
  return process.env.NOTION_API_KEY;
}
