import { Hono } from "hono";
import { OutcomeRecordSchema, type OutcomeRecord } from "@orqestra/domain";
import { getTenantId } from "../../middleware/auth.js";
import * as outcomeStore from "../../services/outcome-store.js";

const app = new Hono();

app.get("/outcomes", (c) => {
  const releaseId = c.req.query("releaseId");
  const ticketId = c.req.query("ticketId");
  const tenantId = getTenantId(c);

  if (releaseId) {
    const outcomes = outcomeStore.getOutcomesByRelease(releaseId, tenantId);
    const ticketIds = outcomeStore.getTicketsByRelease(releaseId, tenantId);
    return c.json({
      releaseId,
      outcomes,
      ...(ticketIds.length > 0 && { ticket_ids: ticketIds }),
    });
  }

  if (ticketId) {
    const releaseIds = outcomeStore.getReleasesByTicket(ticketId, tenantId);
    const result = releaseIds.map((rid) => ({
      releaseId: rid,
      outcomes: outcomeStore.getOutcomesByRelease(rid, tenantId),
    }));
    return c.json({ ticketId, releases: result });
  }

  return c.json({ error: "releaseId or ticketId query required" }, 400);
});

app.post("/outcomes", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const tenantId = getTenantId(c);
  const single = OutcomeRecordSchema.safeParse(body);
  if (single.success) {
    const stored = outcomeStore.addOutcome(single.data, tenantId);
    return c.json(stored, 201);
  }
  if (Array.isArray(body)) {
    const parsed: OutcomeRecord[] = [];
    for (const item of body) {
      const p = OutcomeRecordSchema.safeParse(item);
      if (!p.success) {
        return c.json(
          { error: "Validation failed", details: p.error.flatten() },
          400
        );
      }
      parsed.push(p.data);
    }
    const stored = outcomeStore.addOutcomes(parsed, tenantId);
    return c.json({ outcomes: stored }, 201);
  }
  return c.json(
    { error: "Validation failed", details: single.error.flatten() },
    400
  );
});

app.post("/releases", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : undefined;
  const ticket_ids = Array.isArray(body.ticket_ids)
    ? (body.ticket_ids as string[]).filter((x: unknown) => typeof x === "string")
    : [];
  if (!id) {
    return c.json({ error: "id required" }, 400);
  }
  const tenantId = getTenantId(c);
  if (ticket_ids.length > 0) {
    outcomeStore.linkReleaseToTickets(id, ticket_ids, tenantId);
  }
  return c.json({ id, ticket_ids }, 201);
});

export default app;
