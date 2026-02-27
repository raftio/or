/**
 * RFC-014: Context Bundling Engine – spec + ticket → execution bundle
 */
import { createHash } from "node:crypto";
import * as bundleStore from "./bundle-store.js";
import { synthesizeContext } from "./context-synthesis.js";
import type { ExecutionBundle } from "@orqestra/domain";

export interface BundlingEngineInput {
  workspace_id: string;
  ticket_id: string;
  spec_ref?: string;
}

export function contentHash(bundle: {
  tasks: ExecutionBundle["tasks"];
  acceptance_criteria_refs: string[];
  spec_ref: string;
}): string {
  const payload = JSON.stringify({
    tasks: bundle.tasks,
    acceptance_criteria_refs: [...bundle.acceptance_criteria_refs].sort(),
    spec_ref: bundle.spec_ref,
  });
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Build execution bundle from ticket (+ optional spec).
 * Idempotent: same content → returns existing bundle without creating a new version.
 */
export async function buildBundle(
  input: BundlingEngineInput,
): Promise<ExecutionBundle | null> {
  const context = await synthesizeContext({
    ticket_id: input.ticket_id,
    spec_ref: input.spec_ref,
    workspace_id: input.workspace_id,
  });
  if (!context) return null;

  const spec_ref = input.spec_ref ?? "";
  const ticket_ref = input.ticket_id;

  const tasks: ExecutionBundle["tasks"] = context.sections?.length
    ? context.sections.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.body,
      }))
    : [
        {
          id: "task-1",
          title: context.ticket_title,
          description: context.ticket_description,
        },
      ];

  const acceptance_criteria_refs = context.acceptance_criteria.map(
    (ac) => ac.id,
  );

  const dependencies =
    tasks.length > 1
      ? Array.from({ length: tasks.length - 1 }, (_, i) => ({
          taskId: tasks[i + 1]!.id,
          dependsOn: tasks[i]!.id,
        }))
      : undefined;

  const candidateHash = contentHash({
    tasks,
    acceptance_criteria_refs,
    spec_ref,
  });

  // Fast path: check DB hash index for existing identical bundle
  const existingByHash = await bundleStore.getBundleByHash(
    input.workspace_id,
    ticket_ref,
    candidateHash,
  );
  if (existingByHash) return existingByHash;

  // Determine next version number
  const latest = await bundleStore.getLatestBundle(
    input.workspace_id,
    ticket_ref,
  );
  const nextVersion = latest ? latest.version + 1 : 1;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const bundle: ExecutionBundle = {
    id,
    version: nextVersion,
    spec_ref,
    ticket_ref,
    tasks,
    dependencies,
    acceptance_criteria_refs,
    context: {
      excerpts: context.excerpts,
      related_ticket_ids: context.related_ticket_ids,
    },
    created_at: now,
    updated_at: now,
  };

  return bundleStore.storeBundle(input.workspace_id, bundle, candidateHash);
}
