import { query } from "../db/index.js";
import type { ExecutionBundle } from "@orqestra/domain";

export interface CreateBundleInput {
  workspace_id: string;
  ticket_ref: string;
  spec_ref?: string;
  content_hash?: string;
  tasks?: ExecutionBundle["tasks"];
  dependencies?: ExecutionBundle["dependencies"];
  acceptance_criteria_refs?: string[];
  context?: ExecutionBundle["context"];
}

// ── LRU cache ────────────────────────────────────────────────────────────

interface CacheEntry {
  bundle: ExecutionBundle;
  workspaceId: string;
}

const MAX_CACHE = 500;
const cache = new Map<string, CacheEntry>();

function cacheSet(bundle: ExecutionBundle, workspaceId: string): void {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(bundle.id, { bundle, workspaceId });
}

function cacheGet(id: string): ExecutionBundle | undefined {
  const hit = cache.get(id);
  if (hit) {
    cache.delete(id);
    cache.set(id, hit);
    return hit.bundle;
  }
  return undefined;
}

export function purgeCacheForTicket(workspaceId: string, ticketRef: string): void {
  for (const [id, entry] of cache) {
    if (entry.bundle.ticket_ref === ticketRef && entry.workspaceId === workspaceId) {
      cache.delete(id);
    }
  }
}

// ── Row mapping ──────────────────────────────────────────────────────────

interface BundleRow {
  id: string;
  workspace_id: string;
  ticket_ref: string;
  spec_ref: string;
  version: number;
  content_hash: string;
  tasks: ExecutionBundle["tasks"];
  dependencies: ExecutionBundle["dependencies"] | null;
  acceptance_criteria_refs: string[];
  context: ExecutionBundle["context"] | null;
  created_at: string;
  updated_at: string;
}

function rowToBundle(row: BundleRow): ExecutionBundle {
  return {
    id: row.id,
    version: row.version,
    spec_ref: row.spec_ref,
    ticket_ref: row.ticket_ref,
    tasks: row.tasks,
    dependencies: row.dependencies ?? undefined,
    acceptance_criteria_refs: row.acceptance_criteria_refs,
    context: row.context ?? undefined,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

// ── Public API ───────────────────────────────────────────────────────────

export async function createBundle(input: CreateBundleInput): Promise<ExecutionBundle> {
  const result = await query<BundleRow>(
    `INSERT INTO workspace_bundles
       (workspace_id, ticket_ref, spec_ref, version, content_hash, tasks, dependencies, acceptance_criteria_refs, context)
     VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.workspace_id,
      input.ticket_ref,
      input.spec_ref ?? "",
      input.content_hash ?? "",
      JSON.stringify(input.tasks ?? []),
      input.dependencies ? JSON.stringify(input.dependencies) : null,
      JSON.stringify(input.acceptance_criteria_refs ?? []),
      input.context ? JSON.stringify(input.context) : null,
    ],
  );
  const bundle = rowToBundle(result.rows[0]);
  cacheSet(bundle, input.workspace_id);
  return bundle;
}

export async function storeBundle(
  workspaceId: string,
  bundle: ExecutionBundle,
  contentHash: string,
): Promise<ExecutionBundle> {
  const result = await query<BundleRow>(
    `INSERT INTO workspace_bundles
       (id, workspace_id, ticket_ref, spec_ref, version, content_hash, tasks, dependencies, acceptance_criteria_refs, context)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      bundle.id,
      workspaceId,
      bundle.ticket_ref,
      bundle.spec_ref,
      bundle.version,
      contentHash,
      JSON.stringify(bundle.tasks),
      bundle.dependencies ? JSON.stringify(bundle.dependencies) : null,
      JSON.stringify(bundle.acceptance_criteria_refs),
      bundle.context ? JSON.stringify(bundle.context) : null,
    ],
  );
  const stored = rowToBundle(result.rows[0]);
  cacheSet(stored, workspaceId);
  return stored;
}

export async function getBundle(id: string): Promise<ExecutionBundle | undefined> {
  const hit = cacheGet(id);
  if (hit) return hit;

  const result = await query<BundleRow>(
    `SELECT * FROM workspace_bundles WHERE id = $1`,
    [id],
  );
  if (result.rowCount === 0) return undefined;
  const row = result.rows[0];
  const bundle = rowToBundle(row);
  cacheSet(bundle, row.workspace_id);
  return bundle;
}

export async function getBundlesByTicket(
  workspaceId: string,
  ticketRef: string,
): Promise<ExecutionBundle[]> {
  const result = await query<BundleRow>(
    `SELECT * FROM workspace_bundles
     WHERE workspace_id = $1 AND ticket_ref = $2
     ORDER BY version ASC`,
    [workspaceId, ticketRef],
  );
  const bundles = result.rows.map(rowToBundle);
  for (const b of bundles) cacheSet(b, workspaceId);
  return bundles;
}

export async function getLatestBundle(
  workspaceId: string,
  ticketRef: string,
): Promise<ExecutionBundle | undefined> {
  const result = await query<BundleRow>(
    `SELECT * FROM workspace_bundles
     WHERE workspace_id = $1 AND ticket_ref = $2
     ORDER BY version DESC
     LIMIT 1`,
    [workspaceId, ticketRef],
  );
  if (result.rowCount === 0) return undefined;
  const bundle = rowToBundle(result.rows[0]);
  cacheSet(bundle, workspaceId);
  return bundle;
}

export async function getBundleByHash(
  workspaceId: string,
  ticketRef: string,
  contentHash: string,
): Promise<ExecutionBundle | undefined> {
  const result = await query<BundleRow>(
    `SELECT * FROM workspace_bundles
     WHERE workspace_id = $1 AND ticket_ref = $2 AND content_hash = $3
     ORDER BY version DESC
     LIMIT 1`,
    [workspaceId, ticketRef, contentHash],
  );
  if (result.rowCount === 0) return undefined;
  const bundle = rowToBundle(result.rows[0]);
  cacheSet(bundle, workspaceId);
  return bundle;
}

export async function getBundleHistory(
  workspaceId: string,
  ticketRef: string,
): Promise<ExecutionBundle[]> {
  const result = await query<BundleRow>(
    `SELECT * FROM workspace_bundles
     WHERE workspace_id = $1 AND ticket_ref = $2
     ORDER BY version DESC`,
    [workspaceId, ticketRef],
  );
  return result.rows.map(rowToBundle);
}

export async function listBundles(
  workspaceId: string,
  opts?: { limit?: number; offset?: number },
): Promise<{ bundles: ExecutionBundle[]; total: number }> {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const [dataResult, countResult] = await Promise.all([
    query<BundleRow>(
      `SELECT * FROM (
         SELECT DISTINCT ON (ticket_ref) *
         FROM workspace_bundles
         WHERE workspace_id = $1
         ORDER BY ticket_ref, version DESC
       ) latest
       ORDER BY latest.created_at DESC
       LIMIT $2 OFFSET $3`,
      [workspaceId, limit, offset],
    ),
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT ticket_ref) AS count FROM workspace_bundles WHERE workspace_id = $1`,
      [workspaceId],
    ),
  ]);

  return {
    bundles: dataResult.rows.map(rowToBundle),
    total: Number(countResult.rows[0].count),
  };
}
