/**
 * RFC-017: Evidence Sync Engine – store, dedup, link to ticket/PR
 */
import type { EvidencePayload } from "@orqestra/domain";

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

export function ingestEvidence(payload: EvidencePayload): StoredEvidence {
  const id = payload.id ?? crypto.randomUUID();
  const lifecycle = (payload.lifecycle ?? "created") as StoredEvidence["lifecycle"];
  const stored: StoredEvidence = {
    ...payload,
    id,
    lifecycle,
  };

  if (payload.id && byId.has(payload.id)) {
    byId.set(payload.id, stored);
    return stored;
  }

  byId.set(id, stored);

  let ticketSet = byTicket.get(payload.ticket_id);
  if (!ticketSet) {
    ticketSet = new Set();
    byTicket.set(payload.ticket_id, ticketSet);
  }
  ticketSet.add(id);

  const rpKey = repoPrKey(payload.repo, payload.pr_id);
  let repoPrSet = byRepoPr.get(rpKey);
  if (!repoPrSet) {
    repoPrSet = new Set();
    byRepoPr.set(rpKey, repoPrSet);
  }
  repoPrSet.add(id);

  return stored;
}

export function getEvidenceById(id: string): StoredEvidence | undefined {
  const p = byId.get(id);
  if (!p) return undefined;
  return p as StoredEvidence;
}

export function getEvidenceByTicket(ticketId: string): StoredEvidence[] {
  const ids = byTicket.get(ticketId);
  if (!ids) return [];
  return Array.from(ids)
    .map((id) => byId.get(id))
    .filter((p): p is EvidencePayload => p != null) as StoredEvidence[];
}

export function getEvidenceByRepoPr(
  repo: string,
  prId: string
): StoredEvidence[] {
  const ids = byRepoPr.get(repoPrKey(repo, prId));
  if (!ids) return [];
  return Array.from(ids)
    .map((id) => byId.get(id))
    .filter((p): p is EvidencePayload => p != null) as StoredEvidence[];
}

export function getEvidenceStatus(ticketId: string): {
  complete: boolean;
  payloads: StoredEvidence[];
} {
  const payloads = getEvidenceByTicket(ticketId);
  const complete = payloads.some((p) => p.ci_status === "success");
  return { complete, payloads };
}
