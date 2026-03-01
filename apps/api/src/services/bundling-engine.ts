/**
 * RFC-014: Context Bundling Engine – spec + ticket → execution bundle
 */
import { createHash } from "node:crypto";
import * as bundleStore from "./bundle-store.js";
import { synthesizeContext } from "./context-synthesis.js";
import { createBundleDecomposerForWorkspace, createBundleDecomposer } from "../adapters/ai-decomposer/index.js";
import type { ExecutionBundle } from "@orca/domain";
import type { EmbeddingProvider, VectorStore } from "./vector/contract.js";
import { vectorQuery as dbQuery } from "../db/index.js";

export interface CodeSearchResult {
  file: string;
  lines: string;
  language: string | null;
  score: number;
  code: string;
}

export interface BundlingEngineInput {
  workspace_id: string;
  ticket_id: string;
  spec_ref?: string;
  use_ai?: boolean;
  embeddingProvider?: EmbeddingProvider;
  vectorStore?: VectorStore;
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
 * Search the indexed codebase for code related to the ticket.
 * Returns empty array if no code index is available for the workspace.
 */
export async function searchCode(
  workspaceId: string,
  query: string,
  embeddingProvider: EmbeddingProvider,
  vectorStore: VectorStore,
  limit = 10,
): Promise<CodeSearchResult[]> {
  const repoResult = await dbQuery<{ repo: string }>(
    `SELECT repo FROM workspace_code_index_status
     WHERE workspace_id = $1 AND status = 'ready'
     LIMIT 1`,
    [workspaceId],
  );

  if (repoResult.rows.length === 0) return [];

  const repo = repoResult.rows[0]!.repo;
  const [embedding] = await embeddingProvider.embed([query]);

  const results = await vectorStore.search(embedding!, {
    workspaceId,
    repo,
    limit,
  });

  return results.map((r) => ({
    file: r.filePath,
    lines: `${r.startLine}-${r.endLine}`,
    language: r.language,
    score: Math.round(r.score * 100) / 100,
    code: r.content,
  }));
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
  const ticket_ref = context.ticket_key;

  const decomposer =
    input.use_ai === false
      ? createBundleDecomposer()
      : await createBundleDecomposerForWorkspace(input.workspace_id);

  const result = await decomposer.decompose({
    ticket_title: context.ticket_title,
    ticket_description: context.ticket_description,
    sections: context.sections,
    acceptance_criteria: context.acceptance_criteria,
  });

  const tasks = result.tasks.map((t) => ({
    ...t,
    description: t.description ?? undefined,
  }));
  const acceptance_criteria_refs = result.acceptance_criteria_refs;
  const dependencies = result.dependencies ?? undefined;

  const candidateHash = contentHash({
    tasks,
    acceptance_criteria_refs,
    spec_ref,
  });

  const existingByHash = await bundleStore.getBundleByHash(
    input.workspace_id,
    ticket_ref,
    candidateHash,
  );
  if (existingByHash) return existingByHash;

  const latest = await bundleStore.getLatestBundle(
    input.workspace_id,
    ticket_ref,
  );
  const nextVersion = latest ? latest.version + 1 : 1;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const meta: Record<string, unknown> = {};
  if (result.reasoning) meta.ai_reasoning = result.reasoning;
  if (result.suggested_ac?.length) meta.suggested_ac = result.suggested_ac;

  if (input.embeddingProvider && input.vectorStore) {
    const searchQuery = `${context.ticket_title} ${context.ticket_description}`;
    const codeResults = await searchCode(
      input.workspace_id,
      searchQuery,
      input.embeddingProvider,
      input.vectorStore,
    );
    if (codeResults.length > 0) {
      meta.code_search_results = codeResults;
    }
  }

  if (context.sections?.length) {
    meta.doc_sections = context.sections;
  }

  const bundle: ExecutionBundle = {
    id,
    version: nextVersion,
    title: context.ticket_title ?? "",
    spec_ref,
    ticket_ref,
    status: "active",
    tasks,
    dependencies,
    acceptance_criteria_refs,
    context: {
      excerpts: context.excerpts,
      related_ticket_ids: context.related_ticket_ids,
    },
    created_at: now,
    updated_at: now,
    ...(Object.keys(meta).length > 0 ? { meta } : {}),
  };

  return bundleStore.storeBundle(input.workspace_id, bundle, candidateHash);
}
