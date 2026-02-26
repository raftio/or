import { Hono } from "hono";
import { synthesizeContext } from "../../services/context-synthesis.js";

const app = new Hono();

app.get("/context", async (c) => {
  const ticketId = c.req.query("ticketId");
  if (!ticketId) {
    return c.json({ error: "ticketId query required" }, 400);
  }
  const specRef = c.req.query("spec_ref");
  const context = await synthesizeContext({
    ticket_id: ticketId,
    spec_ref: specRef || undefined,
  });
  if (!context) {
    return c.json({ error: "Ticket not found or synthesis failed" }, 404);
  }
  return c.json({ synthesized: true, ...context });
});

app.post("/context", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const ticket_id =
    typeof body.ticket_id === "string" ? body.ticket_id : undefined;
  if (!ticket_id) {
    return c.json({ error: "ticket_id required" }, 400);
  }
  const spec_ref =
    typeof body.spec_ref === "string" ? body.spec_ref : undefined;
  const context = await synthesizeContext({ ticket_id, spec_ref });
  if (!context) {
    return c.json({ error: "Ticket not found or synthesis failed" }, 404);
  }
  return c.json({ synthesized: true, ...context });
});

export default app;
