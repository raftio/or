/**
 * RFC-017: Evidence Sync Engine – store, dedup, link to ticket/PR
 */
import type { EvidencePayload } from "@orqestra/domain";

const DEFAULT_TENANT = "default";

function tk(tenantId: string, key: string): string {
  return `${tenantId}:${key}`;
}

const byId = new Map<string, EvidencePayload>();
const byTicket = new Map<string, Set<string>>();
const byRepoPr = new Map<string, Set<string>>();

function repoPrKey(repo: string, prId?: string): string {
  return prId ? `${repo}:${prId}` : repo;
}

export interface StoredEvidence extends EvidencePayload {
  id: string;
  lifecycle: "created" | "validated" | "linked";
}

export function ingestEvidence(
  payload: EvidencePayload,
  tenantId: string = DEFAULT_TENANT
): StoredEvidence {
  const id = payload.id ?? crypto.randomUUID();
  const lifecycle = (payload.lifecycle ?? "created") as StoredEvidence["lifecycle"];
  const stored: StoredEvidence = {
    ...payload,
    id,
    lifecycle,
  };

  const idKey = tk(tenantId, id);
  if (payload.id && byId.has(idKey)) {
    byId.set(idKey, stored);
    return stored;
  }

  byId.set(idKey, stored);

  const ticketKey = tk(tenantId, payload.ticket_id);
  let ticketSet = byTicket.get(ticketKey);
  if (!ticketSet) {
    ticketSet = new Set();
    byTicket.set(ticketKey, ticketSet);
  }
  ticketSet.add(id);

  const rpKey = tk(tenantId, repoPrKey(payload.repo, payload.pr_id));
  let repoPrSet = byRepoPr.get(rpKey);
  if (!repoPrSet) {
    repoPrSet = new Set();
    byRepoPr.set(rpKey, repoPrSet);
  }
  repoPrSet.add(id);

  return stored;
}

export function getEvidenceById(
  id: string,
  tenantId: string = DEFAULT_TENANT
): StoredEvidence | undefined {
  const p = byId.get(tk(tenantId, id));
  if (!p) return undefined;
  return p as StoredEvidence;
}

export function getEvidenceByTicket(
  ticketId: string,
  tenantId: string = DEFAULT_TENANT
): StoredEvidence[] {
  const ids = byTicket.get(tk(tenantId, ticketId));
  if (!ids) return [];
  return Array.from(ids)
    .map((id) => byId.get(tk(tenantId, id)))
    .filter((p): p is EvidencePayload => p != null) as StoredEvidence[];
}

export function getEvidenceByRepoPr(
  repo: string,
  prId: string,
  tenantId: string = DEFAULT_TENANT
): StoredEvidence[] {
  const ids = byRepoPr.get(tk(tenantId, repoPrKey(repo, prId)));
  if (!ids) return [];
  return Array.from(ids)
    .map((id) => byId.get(tk(tenantId, id)))
    .filter((p): p is EvidencePayload => p != null) as StoredEvidence[];
}

export function getEvidenceStatus(
  ticketId: string,
  tenantId: string = DEFAULT_TENANT
): { complete: boolean; payloads: StoredEvidence[] } {
  const payloads = getEvidenceByTicket(ticketId, tenantId);
  const complete = payloads.some((p) => p.ci_status === "success");
  return { complete, payloads };
}
