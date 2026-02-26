/**
 * RFC-014: Context Bundling Engine – spec + ticket → execution bundle
 */
import { createHash } from "node:crypto";
import * as bundleStore from "./bundle-store.js";
import { synthesizeContext } from "./context-synthesis.js";
import type { ExecutionBundle } from "../schemas/bundle.js";

export interface BundlingEngineInput {
  ticket_id: string;
  spec_ref?: string;
}

function contentHash(bundle: {
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

function now(): string {
  return new Date().toISOString();
}

/**
 * Build execution bundle from ticket (+ optional spec). Idempotent: same input → same or existing bundle.
 */
export async function buildBundle(
  input: BundlingEngineInput
): Promise<ExecutionBundle | null> {
  const context = await synthesizeContext({
    ticket_id: input.ticket_id,
    spec_ref: input.spec_ref,
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
    (ac) => ac.id
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

  const existing = bundleStore.getBundlesByTicket(ticket_ref);
  const last = existing.length
    ? existing.reduce((a, b) => (a.version >= b.version ? a : b))
    : null;

  if (last) {
    const lastHash = contentHash({
      tasks: last.tasks,
      acceptance_criteria_refs: last.acceptance_criteria_refs,
      spec_ref: last.spec_ref,
    });
    if (lastHash === candidateHash) return last;
  }

  const nextVersion = last ? last.version + 1 : 1;
  const id = crypto.randomUUID();
  const created_at = now();
  const updated_at = created_at;

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
    created_at,
    updated_at,
  };

  bundleStore.storeBundle(bundle);
  return bundle;
}
