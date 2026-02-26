/**
 * RFC-016: PR Intelligence – summary, risk flags, evidence validation
 */
import * as evidenceStore from "./evidence-store.js";
import * as bundleStore from "./bundle-store.js";
import { createGitProvider } from "../adapters/git/index.js";

export interface PrIntelligenceInput {
  repo: string;
  pr_id: string;
  ticket_id?: string;
  pr_title?: string;
  pr_description?: string;
}

export interface RiskFlag {
  code: string;
  severity?: string;
  detail?: string;
}

export interface EvidenceValidation {
  status: "pass" | "fail" | "partial";
  total_ac: number;
  covered_ac?: number;
  evidence_count: number;
}

export interface PrIntelligenceOutput {
  summary: string;
  risk_flags: RiskFlag[];
  evidence_validation: EvidenceValidation;
}

export async function getPrIntelligence(
  input: PrIntelligenceInput,
  tenantId: string = "default"
): Promise<PrIntelligenceOutput> {
  let ticket_id = input.ticket_id;
  let pr_title = input.pr_title;
  let pr_description = input.pr_description;

  if (ticket_id == null || pr_title == null) {
    const git = createGitProvider();
    const pr = await git.getPullRequest(input.repo, input.pr_id);
    if (pr) {
      if (ticket_id == null) ticket_id = git.extractTicketId(pr) ?? undefined;
      if (pr_title == null) pr_title = pr.title;
      if (pr_description == null) pr_description = pr.description;
    }
  }

  const evidenceByPr = evidenceStore.getEvidenceByRepoPr(
    input.repo,
    input.pr_id,
    tenantId
  );
  const evidenceByTicket =
    ticket_id != null
      ? evidenceStore.getEvidenceByTicket(ticket_id, tenantId)
      : [];
  const payloads =
    evidenceByPr.length > 0 ? evidenceByPr : evidenceByTicket;

  let total_ac = 0;
  if (ticket_id) {
    const bundles = bundleStore.getBundlesByTicket(ticket_id, tenantId);
    const latest =
      bundles.length > 0
        ? bundles.reduce((a, b) => (a.version >= b.version ? a : b))
        : null;
    if (latest) total_ac = latest.acceptance_criteria_refs.length;
  }

  const risk_flags: RiskFlag[] = [];
  if (payloads.length === 0) {
    risk_flags.push({
      code: "no_tests",
      severity: "high",
      detail: "No evidence linked to this PR",
    });
  }
  const hasFailure = payloads.some((p) => p.ci_status === "failure");
  if (hasFailure) {
    risk_flags.push({
      code: "ci_failed",
      severity: "high",
      detail: "At least one evidence payload has ci_status failure",
    });
  }

  let status: EvidenceValidation["status"] = "fail";
  if (payloads.length === 0) {
    status = "fail";
  } else if (hasFailure) {
    const allFail = payloads.every((p) => p.ci_status === "failure");
    status = allFail ? "fail" : "partial";
  } else {
    status = "pass";
  }

  const evidence_validation: EvidenceValidation = {
    status,
    total_ac,
    evidence_count: payloads.length,
  };
  if (total_ac > 0 && status === "pass") {
    evidence_validation.covered_ac = total_ac;
  }

  const summary =
    pr_title && pr_description
      ? `${pr_title}\n\n${pr_description}`
      : pr_title ?? (ticket_id ? `PR for ${ticket_id}` : `PR ${input.repo}#${input.pr_id}`);

  return {
    summary,
    risk_flags,
    evidence_validation,
  };
}
