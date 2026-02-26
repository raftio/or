import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";
import health from "./api/health.js";
import v1 from "./api/v1/index.js";
import {
  observabilityMiddleware,
  getMetrics,
} from "./middleware/observability.js";

const app = new Hono();

app.use("*", observabilityMiddleware);
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3001",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  })
);

app.route("/", health);
app.get("/metrics", (c) => c.text(getMetrics(), 200, { "Content-Type": "text/plain" }));
app.route("/", v1);

const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Orqestra listening on http://localhost:${info.port}`);
});
