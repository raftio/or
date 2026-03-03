/**
 * RFC-017: Evidence Sync Engine – store, dedup, link to ticket/PR
 */
import { query } from "../db/index.js";
import type { EvidencePayload } from "@or/domain";

export interface StoredEvidence extends EvidencePayload {
  id: string;
  lifecycle: "created" | "validated" | "linked";
  created_at: string;
  updated_at: string;
}

interface EvidenceRow {
  id: string;
  workspace_id: string;
  repo: string;
  branch: string | null;
  commit_sha: string | null;
  pr_id: string | null;
  ticket_id: string;
  test_results: EvidencePayload["test_results"];
  coverage: EvidencePayload["coverage"] | null;
  ci_logs: string | null;
  validation_signals: EvidencePayload["validation_signals"] | null;
  ci_status: EvidencePayload["ci_status"];
  artifact_urls: string[] | null;
  timestamp: string;
  lifecycle: StoredEvidence["lifecycle"];
  bundle_id: string | null;
  bundle_version: number | null;
  created_at: string;
  updated_at: string;
}

function rowToEvidence(row: EvidenceRow): StoredEvidence {
  return {
    id: row.id,
    repo: row.repo,
    branch: row.branch ?? undefined,
    commit_sha: row.commit_sha ?? undefined,
    pr_id: row.pr_id ?? undefined,
    ticket_id: row.ticket_id,
    test_results: row.test_results,
    coverage: row.coverage ?? undefined,
    ci_logs: row.ci_logs ?? undefined,
    validation_signals: row.validation_signals ?? undefined,
    ci_status: row.ci_status,
    artifact_urls: row.artifact_urls ?? undefined,
    timestamp: new Date(row.timestamp).toISOString(),
    lifecycle: row.lifecycle,
    bundle_id: row.bundle_id ?? undefined,
    bundle_version: row.bundle_version ?? undefined,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

export async function ingestEvidence(
  workspaceId: string,
  payload: EvidencePayload,
): Promise<StoredEvidence> {
  const result = await query<EvidenceRow>(
    `INSERT INTO workspace_evidence
       (workspace_id, repo, branch, commit_sha, pr_id, ticket_id,
        test_results, coverage, ci_logs, validation_signals,
        ci_status, artifact_urls, timestamp, lifecycle, bundle_id, bundle_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    [
      workspaceId,
      payload.repo,
      payload.branch ?? null,
      payload.commit_sha ?? null,
      payload.pr_id ?? null,
      payload.ticket_id,
      JSON.stringify(payload.test_results),
      payload.coverage ? JSON.stringify(payload.coverage) : null,
      payload.ci_logs ?? null,
      payload.validation_signals ? JSON.stringify(payload.validation_signals) : null,
      payload.ci_status,
      payload.artifact_urls ? JSON.stringify(payload.artifact_urls) : null,
      payload.timestamp,
      payload.lifecycle ?? "created",
      payload.bundle_id ?? null,
      payload.bundle_version ?? null,
    ],
  );
  return rowToEvidence(result.rows[0]);
}

export async function getEvidenceById(
  id: string,
): Promise<StoredEvidence | undefined> {
  const result = await query<EvidenceRow>(
    `SELECT * FROM workspace_evidence WHERE id = $1`,
    [id],
  );
  if (result.rowCount === 0) return undefined;
  return rowToEvidence(result.rows[0]);
}

export async function getEvidenceByTicket(
  workspaceId: string,
  ticketId: string,
): Promise<StoredEvidence[]> {
  const result = await query<EvidenceRow>(
    `SELECT * FROM workspace_evidence
     WHERE workspace_id = $1 AND ticket_id = $2
     ORDER BY timestamp DESC`,
    [workspaceId, ticketId],
  );
  return result.rows.map(rowToEvidence);
}

export async function getEvidenceByRepoPr(
  workspaceId: string,
  repo: string,
  prId: string,
): Promise<StoredEvidence[]> {
  const result = await query<EvidenceRow>(
    `SELECT * FROM workspace_evidence
     WHERE workspace_id = $1 AND repo = $2 AND pr_id = $3
     ORDER BY timestamp DESC`,
    [workspaceId, repo, prId],
  );
  return result.rows.map(rowToEvidence);
}

export async function getEvidenceByBundle(
  workspaceId: string,
  bundleId: string,
): Promise<StoredEvidence[]> {
  const result = await query<EvidenceRow>(
    `SELECT * FROM workspace_evidence
     WHERE workspace_id = $1 AND bundle_id = $2
     ORDER BY timestamp DESC`,
    [workspaceId, bundleId],
  );
  return result.rows.map(rowToEvidence);
}

export async function getEvidenceStatus(
  workspaceId: string,
  ticketId: string,
): Promise<{ complete: boolean; payloads: StoredEvidence[] }> {
  const payloads = await getEvidenceByTicket(workspaceId, ticketId);
  const complete = payloads.some((p) => p.ci_status === "success");
  return { complete, payloads };
}

export async function listEvidence(
  workspaceId: string,
  opts?: { limit?: number; offset?: number },
): Promise<{ evidence: StoredEvidence[]; total: number }> {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const [dataResult, countResult] = await Promise.all([
    query<EvidenceRow>(
      `SELECT * FROM workspace_evidence
       WHERE workspace_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [workspaceId, limit, offset],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM workspace_evidence WHERE workspace_id = $1`,
      [workspaceId],
    ),
  ]);

  return {
    evidence: dataResult.rows.map(rowToEvidence),
    total: Number(countResult.rows[0].count),
  };
}
