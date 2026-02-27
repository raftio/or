/**
 * Orqestra worker – periodic bundle sync.
 *
 * Env:
 *   ORQESTRA_API_URL   – API base URL (default: http://localhost:3001)
 *   ORQESTRA_API_TOKEN – API token (oq_...) scoped to a workspace
 *   BUNDLE_SYNC_INTERVAL_MS – poll interval in ms (default: 60000, 0 disables)
 */
import { createClient } from "@orqestra/sdk";

const apiUrl = process.env.ORQESTRA_API_URL || "http://localhost:3001";
const apiToken = process.env.ORQESTRA_API_TOKEN;
const intervalMs = Number(process.env.BUNDLE_SYNC_INTERVAL_MS) || 60_000;

if (!apiToken) {
  console.error("[worker] ORQESTRA_API_TOKEN is required");
  process.exit(1);
}

const client = createClient({ baseUrl: apiUrl, apiToken });

let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const result = await client.syncBundles();
    console.log(
      `[worker] sync: ${result.synced}/${result.total} bundled` +
        (result.errors.length ? `, ${result.errors.length} error(s)` : ""),
    );
    for (const err of result.errors) {
      console.error(`[worker]   ${err}`);
    }
  } catch (err) {
    console.error("[worker] sync failed:", err instanceof Error ? err.message : err);
  } finally {
    running = false;
  }
}

async function main(): Promise<void> {
  console.log(`[worker] starting bundle sync (interval: ${intervalMs}ms, api: ${apiUrl})`);

  const health = await client.getHealth();
  console.log(`[worker] API reachable (status: ${health.status})`);

  await tick();

  if (intervalMs > 0) {
    setInterval(tick, intervalMs);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
