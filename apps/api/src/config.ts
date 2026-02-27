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

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be set and at least 16 characters");
  }
  return secret;
}
