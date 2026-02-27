import { serve } from "@hono/node-server";
import { Hono } from "hono";
import health from "./api/health.js";
import v1 from "./api/v1/index.js";

const app = new Hono();

app.route("/", health);
app.route("/", v1);

const port = Number(process.env.PORT) || 3001;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Orqestra listening on http://localhost:${info.port}`);
});
