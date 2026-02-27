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
