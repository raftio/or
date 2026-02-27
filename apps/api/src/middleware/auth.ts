import type { Context, Next } from "hono";
import crypto from "node:crypto";
import * as jose from "jose";
import { getJwtSecret } from "../config.js";
import { query } from "../db/index.js";

type AuthEnv = {
  Variables: {
    userId: string;
    userEmail: string;
    apiTokenWorkspaceId?: string;
  };
};

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function tryApiToken(
  bearerToken: string,
): Promise<{ userId: string; userEmail: string; workspaceId: string } | null> {
  if (!bearerToken.startsWith("oq_")) return null;

  const tokenHash = hashToken(bearerToken);
  const result = await query<{
    created_by: string;
    workspace_id: string;
    expires_at: string | null;
    revoked_at: string | null;
  }>(
    `SELECT created_by, workspace_id, expires_at, revoked_at
     FROM workspace_api_tokens
     WHERE token_hash = $1`,
    [tokenHash],
  );

  if (result.rowCount === 0) return null;

  const row = result.rows[0];
  if (row.revoked_at) return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;

  // Fire-and-forget last_used_at update
  query(
    `UPDATE workspace_api_tokens SET last_used_at = now() WHERE token_hash = $1`,
    [tokenHash],
  ).catch(() => {});

  const userResult = await query<{ email: string }>(
    `SELECT email FROM users WHERE id = $1`,
    [row.created_by],
  );
  const email = userResult.rows[0]?.email ?? "";

  return { userId: row.created_by, userEmail: email, workspaceId: row.workspace_id };
}

export async function authMiddleware(c: Context<AuthEnv>, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const bearerToken = header.slice(7);

  // Try API token first (cheap prefix check)
  if (bearerToken.startsWith("oq_")) {
    const apiAuth = await tryApiToken(bearerToken);
    if (apiAuth) {
      c.set("userId", apiAuth.userId);
      c.set("userEmail", apiAuth.userEmail);
      c.set("apiTokenWorkspaceId", apiAuth.workspaceId);
      await next();
      return;
    }
    return c.json({ error: "Invalid token" }, 401);
  }

  // Fall back to JWT
  try {
    const secret = new TextEncoder().encode(getJwtSecret());
    const { payload } = await jose.jwtVerify(bearerToken, secret);
    c.set("userId", payload.sub as string);
    c.set("userEmail", (payload.email as string) ?? "");
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
}
