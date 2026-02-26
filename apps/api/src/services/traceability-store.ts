/**
 * RFC-015: AC Traceability – AC ↔ evidence, AC ↔ code refs; query by ticket, PR, or AC.
 */
const DEFAULT_TENANT = "default";

function tk(tenantId: string, key: string): string {
  return `${tenantId}:${key}`;
}

interface AcEvidenceLink {
  ac_id: string;
  evidence_id: string;
}
interface AcCodeRef {
  ac_id: string;
  repo: string;
  pr_id: string;
  commit_sha?: string;
  file_path?: string;
  range?: string;
}

const acEvidence = new Map<string, Set<string>>(); // key = tk(tenant, ac_id), value = Set<evidence_id>
const acCodeRefs = new Map<string, AcCodeRef[]>(); // key = tk(tenant, ac_id), value = AcCodeRef[]

export function linkAcToEvidence(
  ac_id: string,
  evidence_id: string,
  tenantId: string = DEFAULT_TENANT
): void {
  const key = tk(tenantId, ac_id);
  let set = acEvidence.get(key);
  if (!set) {
    set = new Set();
    acEvidence.set(key, set);
  }
  set.add(evidence_id);
}

export function linkAcToCode(
  ac_id: string,
  ref: Omit<AcCodeRef, "ac_id">,
  tenantId: string = DEFAULT_TENANT
): void {
  const key = tk(tenantId, ac_id);
  const list = acCodeRefs.get(key) ?? [];
  list.push({ ...ref, ac_id });
  acCodeRefs.set(key, list);
}

export function getTraceabilityByTicket(
  ticket_id: string,
  acIds: string[],
  tenantId: string = DEFAULT_TENANT
): { ac_id: string; evidence_ids: string[]; code_refs: AcCodeRef[] }[] {
  return acIds.map((ac_id) => {
    const evSet = acEvidence.get(tk(tenantId, ac_id));
    const refs = acCodeRefs.get(tk(tenantId, ac_id)) ?? [];
    return {
      ac_id,
      evidence_ids: evSet ? [...evSet] : [],
      code_refs: refs,
    };
  });
}

export function getTraceabilityByPr(
  repo: string,
  pr_id: string,
  tenantId: string = DEFAULT_TENANT
): { ac_id: string; evidence_ids: string[]; code_refs: AcCodeRef[] }[] {
  const prefix = tenantId + ":";
  const result: { ac_id: string; evidence_ids: string[]; code_refs: AcCodeRef[] }[] = [];
  for (const [key, refs] of acCodeRefs) {
    if (!key.startsWith(prefix)) continue;
    const matching = refs.filter((r) => r.repo === repo && r.pr_id === pr_id);
    if (matching.length === 0) continue;
    const ac_id = key.slice(prefix.length);
    const evSet = acEvidence.get(key);
    result.push({
      ac_id,
      evidence_ids: evSet ? [...evSet] : [],
      code_refs: refs,
    });
  }
  return result;
}

export function getTraceabilityByAc(
  ac_id: string,
  tenantId: string = DEFAULT_TENANT
): { evidence_ids: string[]; code_refs: AcCodeRef[] } {
  const key = tk(tenantId, ac_id);
  const evSet = acEvidence.get(key);
  const refs = acCodeRefs.get(key) ?? [];
  return {
    evidence_ids: evSet ? [...evSet] : [],
    code_refs: refs,
  };
}
