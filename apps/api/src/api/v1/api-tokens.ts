import { Hono } from "hono";
import { z } from "zod";
import crypto from "node:crypto";
import { query } from "../../db/index.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireWorkspaceAdmin } from "../../middleware/workspace-auth.js";

type Env = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

const app = new Hono<Env>();

app.use("*", authMiddleware as never);

function generateToken(): string {
  return `oq_${crypto.randomBytes(16).toString("hex")}`;
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

const EXPIRY_MAP: Record<string, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  never: null,
};

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  expires_in: z.enum(["7d", "30d", "90d", "never"]).default("never"),
});

// ── Generate a new API token ────────────────────────────────────────────

app.post("/workspaces/:id/api-tokens", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const tokenPrefix = rawToken.slice(0, 11);

  const days = EXPIRY_MAP[parsed.data.expires_in];
  const expiresAt = days != null
    ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const result = await query<{
    id: string;
    name: string;
    token_prefix: string;
    expires_at: string | null;
    created_at: string;
  }>(
    `INSERT INTO workspace_api_tokens (workspace_id, created_by, name, token_hash, token_prefix, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, token_prefix, expires_at, created_at`,
    [workspaceId, userId, parsed.data.name, tokenHash, tokenPrefix, expiresAt],
  );

  return c.json({
    token: rawToken,
    api_token: result.rows[0],
  }, 201);
});

// ── List tokens for a workspace ─────────────────────────────────────────

app.get("/workspaces/:id/api-tokens", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const result = await query<{
    id: string;
    name: string;
    token_prefix: string;
    created_by: string;
    creator_email: string;
    expires_at: string | null;
    last_used_at: string | null;
    revoked_at: string | null;
    created_at: string;
  }>(
    `SELECT t.id, t.name, t.token_prefix, t.created_by, u.email AS creator_email,
            t.expires_at, t.last_used_at, t.revoked_at, t.created_at
     FROM workspace_api_tokens t
     JOIN users u ON u.id = t.created_by
     WHERE t.workspace_id = $1
     ORDER BY t.created_at DESC`,
    [workspaceId],
  );

  return c.json({ api_tokens: result.rows });
});

// ── Rename a token ──────────────────────────────────────────────────────

const RenameSchema = z.object({
  name: z.string().min(1).max(100),
});

app.patch("/workspaces/:id/api-tokens/:tokenId", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");
  const tokenId = c.req.param("tokenId");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const body = await c.req.json().catch(() => ({}));
  const parsed = RenameSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const result = await query(
    `UPDATE workspace_api_tokens SET name = $1
     WHERE id = $2 AND workspace_id = $3
     RETURNING id`,
    [parsed.data.name, tokenId, workspaceId],
  );

  if (result.rowCount === 0) {
    return c.json({ error: "Token not found" }, 404);
  }

  return c.json({ updated: true });
});

// ── Revoke a token (soft delete) ────────────────────────────────────────

app.delete("/workspaces/:id/api-tokens/:tokenId", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");
  const tokenId = c.req.param("tokenId");

  const check = await requireWorkspaceAdmin(workspaceId, userId);
  if (!check.ok) return c.json({ error: check.error }, check.status);

  const result = await query(
    `UPDATE workspace_api_tokens SET revoked_at = now()
     WHERE id = $1 AND workspace_id = $2 AND revoked_at IS NULL
     RETURNING id`,
    [tokenId, workspaceId],
  );

  if (result.rowCount === 0) {
    return c.json({ error: "Token not found or already revoked" }, 404);
  }

  return c.json({ revoked: true });
});

export default app;
