import { query } from "../db/index.js";
import { eventBus, type WorkspaceEvent } from "./event-emitter.js";

export const EVENT_TYPES = [
  "bundle.created",
  "bundle.updated",
  "bundle.synced",
  "evidence.submitted",
  "evidence.validated",
  "task.started",
  "task.completed",
  "integration.connected",
  "integration.disconnected",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export async function createEvent(
  workspaceId: string,
  type: string,
  title: string,
  detail: Record<string, unknown> = {},
  actorId?: string | null,
): Promise<WorkspaceEvent> {
  const result = await query<WorkspaceEvent>(
    `INSERT INTO workspace_events (workspace_id, type, title, detail, actor_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, workspace_id, type, title, detail, actor_id, created_at`,
    [workspaceId, type, title, JSON.stringify(detail), actorId ?? null],
  );
  const event = result.rows[0];
  eventBus.emit("event", event);
  return event;
}

export async function listEvents(
  workspaceId: string,
  options: { limit?: number; offset?: number; type?: string; since?: string } = {},
): Promise<{ events: WorkspaceEvent[]; total: number }> {
  const { limit = 50, offset = 0, type, since } = options;

  const conditions = ["workspace_id = $1"];
  const params: unknown[] = [workspaceId];
  let idx = 2;

  if (type) {
    conditions.push(`type = $${idx}`);
    params.push(type);
    idx++;
  }
  if (since) {
    conditions.push(`created_at > $${idx}`);
    params.push(since);
    idx++;
  }

  const where = conditions.join(" AND ");

  const countResult = await query<{ count: string }>(
    `SELECT count(*)::text FROM workspace_events WHERE ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query<WorkspaceEvent>(
    `SELECT id, workspace_id, type, title, detail, actor_id, created_at
     FROM workspace_events
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset],
  );

  return { events: result.rows, total };
}

export async function getEvent(
  workspaceId: string,
  eventId: string,
): Promise<WorkspaceEvent | null> {
  const result = await query<WorkspaceEvent>(
    `SELECT id, workspace_id, type, title, detail, actor_id, created_at
     FROM workspace_events
     WHERE id = $1 AND workspace_id = $2`,
    [eventId, workspaceId],
  );
  return result.rows[0] ?? null;
}
