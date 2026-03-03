import { Hono } from "hono";

const app = new Hono();

const SERVICE_VERSION = "0.1.0";

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.get("/version", (c) => {
  return c.json({ name: "or", version: SERVICE_VERSION });
});

app.get("/", (c) => {
  return c.json({ name: "or", version: SERVICE_VERSION });
});

export default app;
