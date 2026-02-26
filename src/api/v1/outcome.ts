import { Hono } from "hono";

const app = new Hono();

app.get("/outcomes", (c) => {
  const releaseId = c.req.query("releaseId");
  if (!releaseId) {
    return c.json({ error: "releaseId query required" }, 400);
  }
  return c.json(
    {
      error: "Not implemented",
      message: "Outcome tracking will be implemented in a later phase",
      releaseId,
    },
    501
  );
});

export default app;
