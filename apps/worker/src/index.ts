/**
 * Orqestra worker – queue/cron jobs.
 * Add job handlers and schedule here.
 */
async function main(): Promise<void> {
  console.log("Orqestra worker started (no jobs configured yet)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
