import { query } from "../db/index.js";

interface BundleSummary {
  id: string;
  title: string;
  ticket_ref: string;
  status: string;
  version: number;
  tasks: { id: string; title: string }[];
  created_at: string;
}

interface EvidenceSummary {
  ticket_id: string;
  ci_status: string;
  test_results: { pass: number; fail: number; skip?: number };
  timestamp: string;
}

export async function buildChatContext(workspaceId: string): Promise<string> {
  const sections: string[] = [];

  try {
    const bundleResult = await query<{
      id: string;
      title: string;
      ticket_ref: string;
      status: string;
      version: number;
      tasks: { id: string; title: string; description?: string }[];
      created_at: string;
    }>(
      `SELECT id, title, ticket_ref, status, version, tasks, created_at
       FROM workspace_bundles
       WHERE workspace_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [workspaceId],
    );

    if (bundleResult.rows.length > 0) {
      const bundleLines = bundleResult.rows.map((b: BundleSummary) => {
        const displayTitle = b.title || b.ticket_ref;
        const taskList = b.tasks
          .slice(0, 5)
          .map((t) => `  - ${t.id}: ${t.title}`)
          .join("\n");
        const more = b.tasks.length > 5 ? `\n  - ... and ${b.tasks.length - 5} more tasks` : "";
        return `- **${displayTitle}** [${b.ticket_ref}] (v${b.version}, ${b.status}, ${b.created_at})\n${taskList}${more}`;
      });
      sections.push(`### Recent Bundles (${bundleResult.rows.length})\n\n${bundleLines.join("\n\n")}`);
    }
  } catch {
    // DB query failed — skip bundles
  }

  try {
    const evidenceResult = await query<{
      ticket_id: string;
      ci_status: string;
      test_results: { pass: number; fail: number; skip?: number };
      timestamp: string;
    }>(
      `SELECT ticket_id, ci_status, test_results, timestamp
       FROM workspace_evidence
       WHERE workspace_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [workspaceId],
    );

    if (evidenceResult.rows.length > 0) {
      const evidenceLines = evidenceResult.rows.map((e: EvidenceSummary) =>
        `- **${e.ticket_id}**: ${e.ci_status} (${e.test_results.pass} pass, ${e.test_results.fail} fail) @ ${e.timestamp}`,
      );
      sections.push(`### Recent Evidence (${evidenceResult.rows.length})\n\n${evidenceLines.join("\n")}`);
    }
  } catch {
    // DB query failed — skip evidence
  }

  return sections.join("\n\n");
}
