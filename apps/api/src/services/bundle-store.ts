import { query } from "../db/index.js";
import type { ExecutionBundle, BundleStatus } from "@or/domain";

export interface CreateBundleInput {
  workspace_id: string;
  ticket_ref: string;
  title?: string;
  spec_ref?: string;
  content_hash?: string;
  tasks?: ExecutionBundle["tasks"];
  dependencies?: ExecutionBundle["dependencies"];
  acceptance_criteria_refs?: string[];
  context?: ExecutionBundle["context"];
  meta?: Record<string, unknown>;
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
  title: string;
  spec_ref: string;
  version: number;
  content_hash: string;
  status: BundleStatus;
  tasks: ExecutionBundle["tasks"];
  dependencies: ExecutionBundle["dependencies"] | null;
  acceptance_criteria_refs: string[];
  context: ExecutionBundle["context"] | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function rowToBundle(row: BundleRow): ExecutionBundle {
  return {
    id: row.id,
    version: row.version,
    title: row.title ?? "",
    spec_ref: row.spec_ref,
    ticket_ref: row.ticket_ref,
    status: row.status ?? "active",
    tasks: row.tasks,
    dependencies: row.dependencies ?? undefined,
    acceptance_criteria_refs: row.acceptance_criteria_refs,
    context: row.context ?? undefined,
    ...(row.meta ? { meta: row.meta } : {}),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

// ── Public API ───────────────────────────────────────────────────────────

export async function createBundle(input: CreateBundleInput): Promise<ExecutionBundle> {
  const result = await query<BundleRow>(
    `INSERT INTO workspace_bundles
       (workspace_id, ticket_ref, title, spec_ref, version, content_hash, tasks, dependencies, acceptance_criteria_refs, context, meta)
     VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      input.workspace_id,
      input.ticket_ref,
      input.title ?? "",
      input.spec_ref ?? "",
      input.content_hash ?? "",
      JSON.stringify(input.tasks ?? []),
      input.dependencies ? JSON.stringify(input.dependencies) : null,
      JSON.stringify(input.acceptance_criteria_refs ?? []),
      input.context ? JSON.stringify(input.context) : null,
      input.meta ? JSON.stringify(input.meta) : null,
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
       (id, workspace_id, ticket_ref, title, spec_ref, version, content_hash, tasks, dependencies, acceptance_criteria_refs, context, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      bundle.id,
      workspaceId,
      bundle.ticket_ref,
      bundle.title,
      bundle.spec_ref,
      bundle.version,
      contentHash,
      JSON.stringify(bundle.tasks),
      bundle.dependencies ? JSON.stringify(bundle.dependencies) : null,
      JSON.stringify(bundle.acceptance_criteria_refs),
      bundle.context ? JSON.stringify(bundle.context) : null,
      bundle.meta ? JSON.stringify(bundle.meta) : null,
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

export async function getLatestBundlesByTickets(
  workspaceId: string,
  ticketRefs: string[],
): Promise<Map<string, ExecutionBundle>> {
  const map = new Map<string, ExecutionBundle>();
  if (!ticketRefs.length) return map;
  const result = await query<BundleRow>(
    `SELECT DISTINCT ON (ticket_ref) *
     FROM workspace_bundles
     WHERE workspace_id = $1 AND ticket_ref = ANY($2)
     ORDER BY ticket_ref, version DESC`,
    [workspaceId, ticketRefs],
  );
  for (const row of result.rows) {
    const bundle = rowToBundle(row);
    cacheSet(bundle, workspaceId);
    map.set(row.ticket_ref, bundle);
  }
  return map;
}

export async function listBundles(
  workspaceId: string,
  opts?: { limit?: number; offset?: number; status?: BundleStatus; search?: string },
): Promise<{ bundles: ExecutionBundle[]; total: number }> {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  const status = opts?.status;
  const search = opts?.search;

  const dataFilters: string[] = [];
  const countFilters: string[] = [];
  const dataParams: unknown[] = [workspaceId, limit, offset];
  const countParams: unknown[] = [workspaceId];

  if (status) {
    dataParams.push(status);
    dataFilters.push(`status = $${dataParams.length}`);
    countParams.push(status);
    countFilters.push(`status = $${countParams.length}`);
  }

  if (search) {
    const pattern = `%${search}%`;
    dataParams.push(pattern);
    dataFilters.push(
      `(title ILIKE $${dataParams.length} OR ticket_ref ILIKE $${dataParams.length})`,
    );
    countParams.push(pattern);
    countFilters.push(
      `(title ILIKE $${countParams.length} OR ticket_ref ILIKE $${countParams.length})`,
    );
  }

  const dataWhere = dataFilters.length ? `AND ${dataFilters.join(" AND ")}` : "";
  const countWhere = countFilters.length ? `AND ${countFilters.join(" AND ")}` : "";

  const [dataResult, countResult] = await Promise.all([
    query<BundleRow>(
      `SELECT * FROM (
         SELECT DISTINCT ON (ticket_ref) *
         FROM workspace_bundles
         WHERE workspace_id = $1 ${dataWhere}
         ORDER BY ticket_ref, version DESC
       ) latest
       ORDER BY latest.created_at DESC
       LIMIT $2 OFFSET $3`,
      dataParams,
    ),
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT ticket_ref) AS count FROM workspace_bundles WHERE workspace_id = $1 ${countWhere}`,
      countParams,
    ),
  ]);

  return {
    bundles: dataResult.rows.map(rowToBundle),
    total: Number(countResult.rows[0].count),
  };
}

export async function updateBundleStatus(
  workspaceId: string,
  bundleId: string,
  status: BundleStatus,
): Promise<ExecutionBundle | undefined> {
  const result = await query<BundleRow>(
    `UPDATE workspace_bundles
     SET status = $1, updated_at = now()
     WHERE id = $2 AND workspace_id = $3
     RETURNING *`,
    [status, bundleId, workspaceId],
  );
  if (result.rowCount === 0) return undefined;
  const bundle = rowToBundle(result.rows[0]);
  cacheSet(bundle, workspaceId);
  return bundle;
}

/** Update status for every version of a bundle identified by ticket_ref. */
export async function updateAllBundleVersionsStatus(
  workspaceId: string,
  ticketRef: string,
  status: BundleStatus,
): Promise<ExecutionBundle[]> {
  purgeCacheForTicket(workspaceId, ticketRef);

  const result = await query<BundleRow>(
    `UPDATE workspace_bundles
     SET status = $1, updated_at = now()
     WHERE workspace_id = $2 AND ticket_ref = $3
     RETURNING *`,
    [status, workspaceId, ticketRef],
  );

  const bundles = result.rows.map(rowToBundle);
  for (const b of bundles) cacheSet(b, workspaceId);
  return bundles;
}
