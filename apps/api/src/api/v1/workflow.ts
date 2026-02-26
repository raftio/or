import { Hono } from "hono";
import { z } from "zod";
import { FlowEvent, type FlowEventType } from "@orqestra/domain";
import { getTenantId } from "../../middleware/auth.js";
import * as stateEngine from "../../services/state-machine-engine.js";
import * as notification from "../../services/notification.js";

const TriggerTypeSchema = z.enum([
  "ticket_created",
  "ticket_updated",
  "spec_updated",
  "spec_ready",
  "dev_started",
  "pr_opened",
  "pr_updated",
  "pr_opened_or_updated",
  "pr_merged",
  "evidence_received",
  "evidence_validated",
  "validation_failed",
  "metrics_collected",
  "feedback_applied",
  "manual",
]);

const TriggerBodySchema = z.object({
  trigger_type: TriggerTypeSchema,
  ticket_id: z.string().optional(),
  pr_id: z.string().optional(),
  repo: z.string().optional(),
  action: z.string().optional(),
  event_id: z.string().optional(),
});

const VALID_STATE_EVENTS = new Set<string>(Object.values(FlowEvent));

const app = new Hono();

app.post("/workflow/trigger", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = TriggerBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }
  const { trigger_type, ticket_id, pr_id, repo, action, event_id } = parsed.data;

  if (trigger_type === "manual" && !ticket_id) {
    return c.json(
      { error: "ticket_id required when trigger_type is manual" },
      400
    );
  }

  const eventForState: FlowEventType | null =
    trigger_type === "manual" ? null : (trigger_type as FlowEventType);

  if (eventForState && VALID_STATE_EVENTS.has(eventForState) && ticket_id) {
    const tenantId = getTenantId(c);
    const payload = {
      event_id,
      source: "workflow_trigger",
      ticket_id,
      pr_id,
      repo,
      action,
    };
    const result = stateEngine.processEvent(
      ticket_id,
      eventForState,
      payload,
      tenantId
    );
    if (result.transitioned) {
      const ev = eventForState;
      if (ev === "spec_ready") notification.notify("bundle_ready", { ticket_id });
      else if (ev === "pr_opened" || ev === "pr_opened_or_updated")
        notification.notify("pr_ready_for_review", {
          ticket_id,
          pr_id,
          repo,
        });
      else if (ev === "validation_failed")
        notification.notify("evidence_failed", { ticket_id, pr_id, repo });
      else if (ev === "pr_merged")
        notification.notify("pr_merged", { ticket_id, pr_id, repo });
    }
    return c.json({
      triggered: true,
      state: result.state,
      previous_state: result.previous_state,
      transitioned: result.transitioned,
    });
  }

  if (eventForState && !ticket_id) {
    return c.json(
      { error: "ticket_id required for state event", trigger_type: eventForState },
      400
    );
  }

  return c.json({
    triggered: true,
    message: "Trigger accepted; no state transition (notification queued for future use)",
  });
});

export default app;
