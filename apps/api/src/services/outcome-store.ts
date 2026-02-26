/**
 * RFC-019: Outcome store – outcome records by release, optional release↔ticket attribution
 */
import type { OutcomeRecord } from "@orqestra/domain";

const DEFAULT_TENANT = "default";

function tk(tenantId: string, key: string): string {
  return `${tenantId}:${key}`;
}

const outcomesByRelease = new Map<string, OutcomeRecord[]>();
const releaseToTickets = new Map<string, string[]>();

function ensureList(key: string): OutcomeRecord[] {
  let list = outcomesByRelease.get(key);
  if (!list) {
    list = [];
    outcomesByRelease.set(key, list);
  }
  return list;
}

export function addOutcome(
  record: OutcomeRecord,
  tenantId: string = DEFAULT_TENANT
): OutcomeRecord {
  const id = record.id ?? crypto.randomUUID();
  const stored: OutcomeRecord = { ...record, id };
  const key = tk(tenantId, record.release_id);
  const list = ensureList(key);
  list.push(stored);
  return stored;
}

export function addOutcomes(
  records: OutcomeRecord[],
  tenantId: string = DEFAULT_TENANT
): OutcomeRecord[] {
  return records.map((r) => addOutcome(r, tenantId));
}

export function getOutcomesByRelease(
  releaseId: string,
  tenantId: string = DEFAULT_TENANT
): OutcomeRecord[] {
  return [...(outcomesByRelease.get(tk(tenantId, releaseId)) ?? [])];
}

export function linkReleaseToTickets(
  releaseId: string,
  ticketIds: string[],
  tenantId: string = DEFAULT_TENANT
): void {
  releaseToTickets.set(tk(tenantId, releaseId), [...ticketIds]);
}

export function getTicketsByRelease(
  releaseId: string,
  tenantId: string = DEFAULT_TENANT
): string[] {
  return [...(releaseToTickets.get(tk(tenantId, releaseId)) ?? [])];
}

/** Get release IDs that include the given ticket (for attribution view). */
export function getReleasesByTicket(
  ticketId: string,
  tenantId: string = DEFAULT_TENANT
): string[] {
  const prefix = tenantId + ":";
  const releases: string[] = [];
  for (const [key, tickets] of releaseToTickets) {
    if (!key.startsWith(prefix)) continue;
    if (tickets.includes(ticketId)) releases.push(key.slice(prefix.length));
  }
  return releases;
}
