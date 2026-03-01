/**
 * App config from env
 */
export function getTicketProvider(): "stub" | "linear" | "jira" | "github" {
  const v = process.env.TICKET_PROVIDER?.toLowerCase();
  if (v === "linear" || v === "jira" || v === "github") return v;
  return "stub";
}

export function getLinearApiKey(): string | undefined {
  return process.env.LINEAR_API_KEY;
}

export function getContextCacheTtlMinutes(): number {
  const v = process.env.CONTEXT_CACHE_TTL_MINUTES;
  if (v === undefined) return 5;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  return url;
}

/** Separate DB for vector operations (pgvector). Falls back to DATABASE_URL if not set. */
export function getVectorDatabaseUrl(): string | undefined {
  return process.env.VECTOR_DATABASE_URL || process.env.DATABASE_URL;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be set and at least 16 characters");
  }
  return secret;
}

// ── Document Provider ─────────────────────────────────────────────────────

export function getDocumentProvider(): "stub" | "notion" {
  const v = process.env.DOCUMENT_PROVIDER?.toLowerCase();
  if (v === "notion") return v;
  return "stub";
}

export function getNotionApiKey(): string | undefined {
  return process.env.NOTION_API_KEY;
}

// ── AI Decomposer ────────────────────────────────────────────────────────

export type AiDecomposerProvider = "stub" | "openai" | "anthropic";

const DEFAULT_MODELS: Record<Exclude<AiDecomposerProvider, "stub">, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-20250514",
};

export function getAiDecomposerProvider(): AiDecomposerProvider {
  const v = process.env.AI_DECOMPOSER_PROVIDER?.toLowerCase();
  if (v === "openai" || v === "anthropic") return v;
  return "stub";
}

export function getAiDecomposerModel(): string {
  const explicit = process.env.AI_DECOMPOSER_MODEL?.trim();
  if (explicit) return explicit;
  const provider = getAiDecomposerProvider();
  return provider === "stub" ? "" : DEFAULT_MODELS[provider];
}

export function getOpenAiApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY;
}

export function getAnthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY;
}

// ── AI Chat Agent ─────────────────────────────────────────────────────────

export type AiChatProvider = "stub" | "openai" | "anthropic";

const DEFAULT_CHAT_MODELS: Record<Exclude<AiChatProvider, "stub">, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-20250514",
};

export function getAiChatProvider(): AiChatProvider {
  const v = process.env.AI_CHAT_PROVIDER?.toLowerCase();
  if (v === "openai" || v === "anthropic") return v;
  return "stub";
}

export function getAiChatModel(): string {
  const explicit = process.env.AI_CHAT_MODEL?.trim();
  if (explicit) return explicit;
  const provider = getAiChatProvider();
  return provider === "stub" ? "" : DEFAULT_CHAT_MODELS[provider];
}