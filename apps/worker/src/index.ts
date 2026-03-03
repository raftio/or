/**
 * OR worker – periodic bundle sync and code index sync.
 *
 * Env:
 *   OR_API_URL   – API base URL (default: http://localhost:3001)
 *   OR_API_TOKEN – API token (oq_...) scoped to a workspace
 *   BUNDLE_SYNC_INTERVAL_MS   – bundle poll interval in ms (default: 60000, 0 disables)
 *   CODE_INDEX_INTERVAL_MS    – code index poll interval in ms (default: 300000, 0 disables)
 */
import { createClient } from "@or/sdk";

const apiUrl = process.env.OR_API_URL || "http://localhost:3001";
const apiToken = process.env.OR_API_TOKEN;
const bundleIntervalMs = Number(process.env.BUNDLE_SYNC_INTERVAL_MS) || 60_000;
const codeIndexIntervalMs = Number(process.env.CODE_INDEX_INTERVAL_MS) || 300_000;

if (!apiToken) {
  console.error("[worker] OR_API_TOKEN is required");
  process.exit(1);
}

const client = createClient({ baseUrl: apiUrl, apiToken });

// ── Bundle sync ─────────────────────────────────────────────────────────

let bundleRunning = false;

async function tickBundles(): Promise<void> {
  if (bundleRunning) return;
  bundleRunning = true;
  try {
    const result = await client.syncBundles();
    console.log(
      `[worker] bundle-sync: ${result.synced}/${result.total} bundled, ${result.skipped} skipped` +
        (result.errors.length ? `, ${result.errors.length} error(s)` : ""),
    );
    for (const err of result.errors) {
      console.error(`[worker]   ${err}`);
    }
  } catch (err) {
    console.error("[worker] bundle-sync failed:", err instanceof Error ? err.message : err);
  } finally {
    bundleRunning = false;
  }
}

// ── Code index sync ─────────────────────────────────────────────────────

let codeIndexRunning = false;

async function tickCodeIndex(): Promise<void> {
  if (codeIndexRunning) return;
  codeIndexRunning = true;
  try {
    const result = await client.syncCodeIndex();
    console.log(`[worker] code-index: triggered ${result.triggered} workspace(s)`);
  } catch (err) {
    console.error("[worker] code-index failed:", err instanceof Error ? err.message : err);
  } finally {
    codeIndexRunning = false;
  }
}

// ── Main ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(
    `[worker] starting (bundle: ${bundleIntervalMs}ms, code-index: ${codeIndexIntervalMs}ms, api: ${apiUrl})`,
  );

  const health = await client.getHealth();
  console.log(`[worker] API reachable (status: ${health.status})`);

  await tickBundles();
  await tickCodeIndex();

  if (bundleIntervalMs > 0) {
    setInterval(tickBundles, bundleIntervalMs);
  }

  if (codeIndexIntervalMs > 0) {
    setInterval(tickCodeIndex, codeIndexIntervalMs);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
