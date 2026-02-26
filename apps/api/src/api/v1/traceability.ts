import { Hono } from "hono";
import { getTenantId } from "../../middleware/auth.js";
import * as bundleStore from "../../services/bundle-store.js";
import * as traceabilityStore from "../../services/traceability-store.js";

const app = new Hono();

app.get("/traceability", (c) => {
  const ticketId = c.req.query("ticketId");
  const repo = c.req.query("repo");
  const prId = c.req.query("prId");
  const tenantId = getTenantId(c);

  if (ticketId) {
    const bundles = bundleStore.getBundlesByTicket(ticketId, tenantId);
    const latest =
      bundles.length > 0
        ? bundles.reduce((a, b) => (a.version >= b.version ? a : b))
        : null;
    const acIds = latest?.acceptance_criteria_refs ?? [];
    const items = traceabilityStore.getTraceabilityByTicket(
      ticketId,
      acIds,
      tenantId
    );
    return c.json({ ticketId, traceability: items });
  }

  if (repo && prId) {
    const items = traceabilityStore.getTraceabilityByPr(repo, prId, tenantId);
    return c.json({ repo, prId, traceability: items });
  }

  return c.json({ error: "ticketId or repo and prId required" }, 400);
});

app.get("/traceability/ac/:acId", (c) => {
  const acId = c.req.param("acId");
  const result = traceabilityStore.getTraceabilityByAc(
    acId,
    getTenantId(c)
  );
  return c.json({ ac_id: acId, ...result });
});

export default app;
