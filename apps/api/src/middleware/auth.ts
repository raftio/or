/**
 * RFC-020: Auth middleware – API key, tenant context (opt-in via REQUIRE_AUTH).
 */
import type { Context, Next } from "hono";
import { getRequireAuth, getApiKeys } from "../config.js";

const TENANT_ID = "tenant_id";

export function getTenantId(c: Context): string {
  return (c.get(TENANT_ID) as string) ?? "default";
}

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const path = new URL(c.req.url).pathname;
  if (path.includes("/webhooks/")) {
    c.set(TENANT_ID, "default");
    return next();
  }
  if (!getRequireAuth()) {
    c.set(TENANT_ID, "default");
    return next();
  }
  const auth = c.req.header("Authorization");
  const apiKeyHeader = c.req.header("X-API-Key");
  const token = apiKeyHeader ?? (auth?.startsWith("Bearer ") ? auth.slice(7) : undefined);
  if (!token) {
    return c.json({ error: "Unauthorized", message: "API key required" }, 401);
  }
  const keys = getApiKeys();
  const entry = keys.find((e) => e.key === token);
  if (!entry) {
    return c.json({ error: "Unauthorized", message: "Invalid API key" }, 401);
  }
  c.set(TENANT_ID, entry.tenantId);
  return next();
}
