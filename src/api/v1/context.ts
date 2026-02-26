import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  const ticketId = c.req.query("ticketId");
  if (!ticketId) {
    return c.json({ error: "ticketId query required" }, 400);
  }
  return c.json({
    synthesized: true,
    ticket_id: ticketId,
    context: { excerpts: [], related_ticket_ids: [] },
  });
});

app.post("/", (c) => {
  return c.json({
    synthesized: true,
    context: { excerpts: [], related_ticket_ids: [] },
  });
});

export default app;
