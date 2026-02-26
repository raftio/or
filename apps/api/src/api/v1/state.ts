import { Hono } from "hono";
import { FlowEvent, type FlowEventType } from "@orqestra/domain";
import { getTenantId } from "../../middleware/auth.js";
import * as stateEngine from "../../services/state-machine-engine.js";
import * as notification from "../../services/notification.js";

const app = new Hono();

const VALID_EVENTS = new Set<string>(Object.values(FlowEvent));

app.get("/state", (c) => {
  const ticketId = c.req.query("ticketId");
  if (!ticketId) {
    return c.json({ error: "ticketId query required" }, 400);
  }
  const result = stateEngine.getState(ticketId, getTenantId(c));
  if (!result) {
    return c.json({ error: "State not found for ticket" }, 404);
  }
  return c.json(result);
});

app.post("/state/events", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const ticket_id =
    typeof body.ticket_id === "string" ? body.ticket_id : undefined;
  const event = typeof body.event === "string" ? body.event : undefined;
  if (!ticket_id || !event) {
    return c.json({ error: "ticket_id and event required" }, 400);
  }
  if (!VALID_EVENTS.has(event)) {
    return c.json({ error: "Invalid event", valid_events: [...VALID_EVENTS] }, 400);
  }
  const tenantId = getTenantId(c);
  const payload = { ...body, ticket_id, event };
  const result = stateEngine.processEvent(
    ticket_id,
    event as FlowEventType,
    payload,
    tenantId
  );
  if (result.transitioned) {
    const ev = event as string;
    if (ev === "spec_ready") notification.notify("bundle_ready", { ticket_id });
    else if (ev === "pr_opened" || ev === "pr_opened_or_updated")
      notification.notify("pr_ready_for_review", {
        ticket_id,
        pr_id: body.pr_id,
        repo: body.repo,
      });
    else if (ev === "validation_failed")
      notification.notify("evidence_failed", {
        ticket_id,
        pr_id: body.pr_id,
        repo: body.repo,
      });
    else if (ev === "pr_merged")
      notification.notify("pr_merged", {
        ticket_id,
        pr_id: body.pr_id,
        repo: body.repo,
      });
  }
  return c.json(result);
});

export default app;
