import { Hono } from "hono";
import { z } from "zod";
import { query } from "../../db/index.js";
import { authMiddleware } from "../../middleware/auth.js";

type Env = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

const app = new Hono<Env>();

app.use("*", authMiddleware as never);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Workspace CRUD ──────────────────────────────────────────────────────

const CreateWorkspaceSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z.string().min(1).max(100).optional(),
});

app.post("/workspaces", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { name } = parsed.data;
  const slug = parsed.data.slug || slugify(name) || `ws-${Date.now()}`;

  try {
    const wsResult = await query<{ id: string; name: string; slug: string; created_at: string }>(
      `INSERT INTO workspaces (name, slug, owner_id) VALUES ($1, $2, $3)
       RETURNING id, name, slug, created_at`,
      [name.trim(), slug, userId],
    );
    const workspace = wsResult.rows[0];

    await query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [workspace.id, userId],
    );

    return c.json({ workspace }, 201);
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      return c.json({ error: "A workspace with this slug already exists" }, 409);
    }
    throw err;
  }
});

app.get("/workspaces", async (c) => {
  const userId = c.get("userId");

  const result = await query<{
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    role: string;
    member_count: string;
    created_at: string;
  }>(
    `SELECT w.id, w.name, w.slug, w.owner_id, wm.role,
            (SELECT COUNT(*) FROM workspace_members wm2 WHERE wm2.workspace_id = w.id) AS member_count,
            w.created_at
     FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $1
     ORDER BY w.created_at ASC`,
    [userId],
  );

  return c.json({
    workspaces: result.rows.map((r) => ({
      ...r,
      member_count: Number(r.member_count),
    })),
  });
});

app.get("/workspaces/:id", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const memberCheck = await query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  if (memberCheck.rowCount === 0) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  const result = await query<{
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    created_at: string;
    updated_at: string;
    member_count: string;
  }>(
    `SELECT w.*,
            (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id) AS member_count
     FROM workspaces w WHERE w.id = $1`,
    [workspaceId],
  );

  const workspace = result.rows[0];
  if (!workspace) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  return c.json({ workspace: { ...workspace, member_count: Number(workspace.member_count) } });
});

const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).optional(),
});

app.patch("/workspaces/:id", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const roleCheck = await query<{ role: string }>(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  if (roleCheck.rowCount === 0) {
    return c.json({ error: "Workspace not found" }, 404);
  }
  if (!["owner", "admin"].includes(roleCheck.rows[0].role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (parsed.data.name) {
    updates.push(`name = $${idx++}`);
    values.push(parsed.data.name.trim());
  }
  if (parsed.data.slug) {
    updates.push(`slug = $${idx++}`);
    values.push(parsed.data.slug);
  }

  if (updates.length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  updates.push(`updated_at = now()`);
  values.push(workspaceId);

  try {
    const result = await query<{ id: string; name: string; slug: string; updated_at: string }>(
      `UPDATE workspaces SET ${updates.join(", ")} WHERE id = $${idx} RETURNING id, name, slug, updated_at`,
      values,
    );
    return c.json({ workspace: result.rows[0] });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      return c.json({ error: "A workspace with this slug already exists" }, 409);
    }
    throw err;
  }
});

app.delete("/workspaces/:id", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const roleCheck = await query<{ role: string }>(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  if (roleCheck.rowCount === 0) {
    return c.json({ error: "Workspace not found" }, 404);
  }
  if (roleCheck.rows[0].role !== "owner") {
    return c.json({ error: "Only the workspace owner can delete the workspace" }, 403);
  }

  await query(`DELETE FROM workspaces WHERE id = $1`, [workspaceId]);
  return c.json({ deleted: true });
});

// ── Member Management ───────────────────────────────────────────────────

app.get("/workspaces/:id/members", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const memberCheck = await query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  if (memberCheck.rowCount === 0) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  const result = await query<{
    id: string;
    user_id: string;
    role: string;
    joined_at: string;
    user_email: string;
    user_name: string;
  }>(
    `SELECT wm.id, wm.user_id, wm.role, wm.joined_at, u.email AS user_email, u.name AS user_name
     FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = $1
     ORDER BY wm.joined_at ASC`,
    [workspaceId],
  );

  return c.json({ members: result.rows });
});

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
});

app.post("/workspaces/:id/invitations", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const roleCheck = await query<{ role: string }>(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  if (roleCheck.rowCount === 0) {
    return c.json({ error: "Workspace not found" }, 404);
  }
  if (!["owner", "admin"].includes(roleCheck.rows[0].role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const email = parsed.data.email.toLowerCase().trim();
  const { role } = parsed.data;

  const existingMember = await query(
    `SELECT 1 FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = $1 AND u.email = $2`,
    [workspaceId, email],
  );
  if ((existingMember.rowCount ?? 0) > 0) {
    return c.json({ error: "User is already a member of this workspace" }, 409);
  }

  const existingInvite = await query(
    `SELECT 1 FROM workspace_invitations
     WHERE workspace_id = $1 AND email = $2 AND status = 'pending'`,
    [workspaceId, email],
  );
  if ((existingInvite.rowCount ?? 0) > 0) {
    return c.json({ error: "An invitation has already been sent to this email" }, 409);
  }

  const result = await query<{ id: string; token: string; created_at: string; expires_at: string }>(
    `INSERT INTO workspace_invitations (workspace_id, email, role, invited_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, token, created_at, expires_at`,
    [workspaceId, email, role, userId],
  );

  return c.json({ invitation: { ...result.rows[0], email, role } }, 201);
});

app.patch("/workspaces/:id/members/:memberId", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");
  const memberId = c.req.param("memberId");

  const roleCheck = await query<{ role: string }>(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  if (roleCheck.rowCount === 0) {
    return c.json({ error: "Workspace not found" }, 404);
  }
  if (!["owner", "admin"].includes(roleCheck.rows[0].role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ role: z.enum(["admin", "member"]) }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const target = await query<{ role: string }>(
    `SELECT role FROM workspace_members WHERE id = $1 AND workspace_id = $2`,
    [memberId, workspaceId],
  );
  if (target.rowCount === 0) {
    return c.json({ error: "Member not found" }, 404);
  }
  if (target.rows[0].role === "owner") {
    return c.json({ error: "Cannot change the owner's role" }, 403);
  }

  await query(
    `UPDATE workspace_members SET role = $1 WHERE id = $2`,
    [parsed.data.role, memberId],
  );

  return c.json({ updated: true });
});

app.delete("/workspaces/:id/members/:memberId", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");
  const memberId = c.req.param("memberId");

  const roleCheck = await query<{ role: string }>(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  if (roleCheck.rowCount === 0) {
    return c.json({ error: "Workspace not found" }, 404);
  }
  if (!["owner", "admin"].includes(roleCheck.rows[0].role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const target = await query<{ role: string; user_id: string }>(
    `SELECT role, user_id FROM workspace_members WHERE id = $1 AND workspace_id = $2`,
    [memberId, workspaceId],
  );
  if (target.rowCount === 0) {
    return c.json({ error: "Member not found" }, 404);
  }
  if (target.rows[0].role === "owner") {
    return c.json({ error: "Cannot remove the workspace owner" }, 403);
  }

  await query(`DELETE FROM workspace_members WHERE id = $1`, [memberId]);
  return c.json({ removed: true });
});

// ── Invitation Accept (public-ish, but requires auth) ───────────────────

app.post("/invitations/:token/accept", async (c) => {
  const userId = c.get("userId");
  const userEmail = c.get("userEmail");
  const token = c.req.param("token");

  const result = await query<{
    id: string;
    workspace_id: string;
    email: string;
    role: string;
    status: string;
    expires_at: string;
  }>(
    `SELECT id, workspace_id, email, role, status, expires_at
     FROM workspace_invitations WHERE token = $1`,
    [token],
  );

  if (result.rowCount === 0) {
    return c.json({ error: "Invitation not found" }, 404);
  }

  const invitation = result.rows[0];

  if (invitation.status !== "pending") {
    return c.json({ error: "Invitation has already been used or expired" }, 400);
  }

  if (new Date(invitation.expires_at) < new Date()) {
    await query(`UPDATE workspace_invitations SET status = 'expired' WHERE id = $1`, [invitation.id]);
    return c.json({ error: "Invitation has expired" }, 400);
  }

  if (invitation.email !== userEmail.toLowerCase()) {
    return c.json({ error: "This invitation was sent to a different email address" }, 403);
  }

  const existingMember = await query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [invitation.workspace_id, userId],
  );
  if ((existingMember.rowCount ?? 0) > 0) {
    await query(`UPDATE workspace_invitations SET status = 'accepted' WHERE id = $1`, [invitation.id]);
    return c.json({ error: "You are already a member of this workspace" }, 409);
  }

  await query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)`,
    [invitation.workspace_id, userId, invitation.role],
  );
  await query(`UPDATE workspace_invitations SET status = 'accepted' WHERE id = $1`, [invitation.id]);

  const ws = await query<{ id: string; name: string; slug: string }>(
    `SELECT id, name, slug FROM workspaces WHERE id = $1`,
    [invitation.workspace_id],
  );

  return c.json({ joined: true, workspace: ws.rows[0] });
});

// ── Pending invitations for a workspace ─────────────────────────────────

app.get("/workspaces/:id/invitations", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");

  const roleCheck = await query<{ role: string }>(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  if (roleCheck.rowCount === 0) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  const result = await query<{
    id: string;
    email: string;
    role: string;
    status: string;
    created_at: string;
    expires_at: string;
  }>(
    `SELECT id, email, role, status, created_at, expires_at
     FROM workspace_invitations
     WHERE workspace_id = $1 AND status = 'pending'
     ORDER BY created_at DESC`,
    [workspaceId],
  );

  return c.json({ invitations: result.rows });
});

export default app;
