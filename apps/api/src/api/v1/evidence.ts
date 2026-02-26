import { Hono } from "hono";
import { EvidencePayloadSchema } from "@orqestra/domain";
import { getCiWebhookSecret } from "../../config.js";
import { getTenantId } from "../../middleware/auth.js";
import * as bundleStore from "../../services/bundle-store.js";
import * as evidenceStore from "../../services/evidence-store.js";
import * as traceabilityStore from "../../services/traceability-store.js";

const app = new Hono();

function checkCiWebhookAuth(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const secret = getCiWebhookSecret();
  if (!secret) return true;
  const headerSecret = c.req.header("X-Orqestra-Webhook-Secret");
  const auth = c.req.header("Authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
  return headerSecret === secret || bearer === secret;
}

app.post("/evidence", async (c) => {
  if (!checkCiWebhookAuth(c)) {
    return c.json({ error: "Unauthorized", message: "CI webhook secret required" }, 401);
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = EvidencePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }
  const tenantId = getTenantId(c);
  const stored = evidenceStore.ingestEvidence(parsed.data, tenantId);
  const bundles = bundleStore.getBundlesByTicket(parsed.data.ticket_id, tenantId);
  const latest =
    bundles.length > 0
      ? bundles.reduce((a, b) => (a.version >= b.version ? a : b))
      : null;
  const acIds = latest?.acceptance_criteria_refs ?? [];
  for (const ac_id of acIds) {
    traceabilityStore.linkAcToEvidence(ac_id, stored.id, tenantId);
  }
  return c.json(stored, 201);
});

app.get("/evidence/status", (c) => {
  const ticketId = c.req.query("ticketId");
  if (!ticketId) {
    return c.json({ error: "ticketId query required" }, 400);
  }
  const status = evidenceStore.getEvidenceStatus(ticketId, getTenantId(c));
  return c.json(status);
});

app.get("/evidence/:id", (c) => {
  const id = c.req.param("id");
  const evidence = evidenceStore.getEvidenceById(id, getTenantId(c));
  if (!evidence) {
    return c.json({ error: "Evidence not found" }, 404);
  }
  return c.json(evidence);
});

app.get("/evidence", (c) => {
  const ticketId = c.req.query("ticketId");
  const repo = c.req.query("repo");
  const prId = c.req.query("prId");

  const tenantId = getTenantId(c);
  if (ticketId) {
    const payloads = evidenceStore.getEvidenceByTicket(ticketId, tenantId);
    return c.json({ evidence: payloads });
  }
  if (repo && prId) {
    const payloads = evidenceStore.getEvidenceByRepoPr(repo, prId, tenantId);
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
