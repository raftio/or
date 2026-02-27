/**
 * RFC-007: Intent → Execution → Evidence → Outcome State Machine
 */
export const FlowState = {
  Intent: "Intent",
  Bundled: "Bundled",
  InProgress: "InProgress",
  EvidenceSubmitted: "EvidenceSubmitted",
  Validated: "Validated",
  Released: "Released",
  OutcomeMeasured: "OutcomeMeasured",
} as const;

export type FlowStateType = (typeof FlowState)[keyof typeof FlowState];

export const FlowEvent = {
  ticket_created: "ticket_created",
  ticket_updated: "ticket_updated",
  spec_updated: "spec_updated",
  spec_ready: "spec_ready",
  dev_started: "dev_started",
  pr_opened: "pr_opened",
  pr_updated: "pr_updated",
  pr_opened_or_updated: "pr_opened_or_updated",
  pr_merged: "pr_merged",
  evidence_received: "evidence_received",
  evidence_validated: "evidence_validated",
  validation_failed: "validation_failed",
  metrics_collected: "metrics_collected",
  feedback_applied: "feedback_applied",
} as const;

export type FlowEventType = (typeof FlowEvent)[keyof typeof FlowEvent];

export interface FlowEventPayload {
  event_id?: string;
  source?: string;
  timestamp?: string;
  ticket_id?: string;
  pr_id?: string;
  [key: string]: unknown;
}
