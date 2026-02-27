import { Hono } from "hono";

const app = new Hono();

app.post("/workflow/trigger", (c) => {
  return c.json(
    {
      error: "Not implemented",
      message: "Workflow orchestration will be implemented in a later phase",
    },
    501
  );
});

export default app;
