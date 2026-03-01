import { config } from "dotenv";
import { resolve } from "path";
import { existsSync } from "fs";

const rootEnv = resolve(process.cwd(), "..", "..", ".env");
if (existsSync(rootEnv)) {
  config({ path: rootEnv });
} else {
  config();
}

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import health from "./api/health.js";
import v1 from "./api/v1/index.js";
import auth from "./api/auth.js";
import { ensureUsersTable, ensureWorkspaceTables, ensureIntegrationTables, ensureApiTokenTables, ensureBundleTables, ensureEvidenceTables, ensureChatTables, ensureMemoryTables, ensureVectorTables } from "./db/index.js";

const app = new Hono();

app.use("*", cors({ origin: "*", credentials: true }));

app.route("/", health);
app.route("/auth", auth);
app.route("/", v1);

const port = Number(process.env.PORT) || 3001;

async function start() {
  try {
    await ensureUsersTable();
    await ensureWorkspaceTables();
    await ensureIntegrationTables();
    await ensureApiTokenTables();
    await ensureBundleTables();
    await ensureEvidenceTables();
    await ensureChatTables();
    await ensureMemoryTables();
  } catch (e) {
    console.error("Failed to ensure database tables (is DATABASE_URL set?):", e);
    process.exit(1);
  }

  // Vector tables require the pgvector extension — non-fatal if unavailable
  try {
    await ensureVectorTables();
  } catch (e) {
    console.warn(
      "[vector] pgvector extension not available — code indexing features disabled.",
      e instanceof Error ? e.message : e,
    );
  }

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Orca listening on http://localhost:${info.port}`);
  });
}

start();
