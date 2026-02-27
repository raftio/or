import { query } from "../db/index.js";

export async function requireWorkspaceAdmin(
  workspaceId: string,
  userId: string,
): Promise<{ ok: true; role: string } | { ok: false; status: 403 | 404; error: string }> {
  const result = await query<{ role: string }>(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  if (result.rowCount === 0) {
    return { ok: false, status: 404, error: "Workspace not found" };
  }
  if (!["owner", "admin"].includes(result.rows[0].role)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, role: result.rows[0].role };
}

export async function requireWorkspaceMember(
  workspaceId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; status: 404; error: string }> {
  const result = await query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  if (result.rowCount === 0) {
    return { ok: false, status: 404, error: "Workspace not found" };
  }
  return { ok: true };
}
