import { Hono } from "hono";
import { EvidencePayloadSchema } from "@orqestra/domain";
import * as evidenceStore from "../../services/evidence-store.js";

const app = new Hono();

app.post("/evidence", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = EvidencePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }
  const stored = evidenceStore.ingestEvidence(parsed.data);
  return c.json(stored, 201);
});

app.get("/evidence/status", (c) => {
  const ticketId = c.req.query("ticketId");
  if (!ticketId) {
    return c.json({ error: "ticketId query required" }, 400);
  }
  const status = evidenceStore.getEvidenceStatus(ticketId);
  return c.json(status);
});

app.get("/evidence/:id", (c) => {
  const id = c.req.param("id");
  const evidence = evidenceStore.getEvidenceById(id);
  if (!evidence) {
    return c.json({ error: "Evidence not found" }, 404);
  }
  return c.json(evidence);
});

app.get("/evidence", (c) => {
  const ticketId = c.req.query("ticketId");
  const repo = c.req.query("repo");
  const prId = c.req.query("prId");

  if (ticketId) {
    const payloads = evidenceStore.getEvidenceByTicket(ticketId);
    return c.json({ evidence: payloads });
  }
  if (repo && prId) {
    const payloads = evidenceStore.getEvidenceByRepoPr(repo, prId);
    return c.json({ evidence: payloads });
  }
  return c.json({ error: "ticketId or repo and prId required" }, 400);
});

app.post("/evidence/validate", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = EvidencePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }
  return c.json({
    valid: parsed.data.ci_status === "success",
    payload_id: parsed.data.id,
    ci_status: parsed.data.ci_status,
  });
});

export default app;
