import { Hono } from "hono";
import { getTenantId } from "../../middleware/auth.js";
import { getPrIntelligence } from "../../services/pr-intelligence.js";

const app = new Hono();

app.get("/pr-intelligence", async (c) => {
  const repo = c.req.query("repo");
  const prId = c.req.query("prId");
  const ticketId = c.req.query("ticketId");
  if (!repo || !prId) {
    return c.json({ error: "repo and prId query required" }, 400);
  }
  const result = await getPrIntelligence(
    {
      repo,
      pr_id: prId,
      ticket_id: ticketId || undefined,
    },
    getTenantId(c)
  );
  return c.json(result);
});

app.post("/pr-intelligence", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const repo = typeof body.repo === "string" ? body.repo : undefined;
  const pr_id = typeof body.pr_id === "string" ? body.pr_id : undefined;
  if (!repo || !pr_id) {
    return c.json({ error: "repo and pr_id required" }, 400);
  }
  const ticket_id =
    typeof body.ticket_id === "string" ? body.ticket_id : undefined;
  const pr_title =
    typeof body.pr_title === "string" ? body.pr_title : undefined;
  const pr_description =
    typeof body.pr_description === "string" ? body.pr_description : undefined;
  const result = await getPrIntelligence(
    {
      repo,
      pr_id,
      ticket_id,
      pr_title,
      pr_description,
    },
    getTenantId(c)
  );
  return c.json(result);
});

export default app;
