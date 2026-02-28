/**
 * LLM-powered bundle decomposer using Vercel AI SDK.
 * Provider-agnostic: accepts any LanguageModel instance from @ai-sdk/*.
 */
import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import { DecompositionResultSchema } from "@orca/domain";
import type { DecompositionResult } from "@orca/domain";
import type { BundleDecomposer } from "./contract.js";
import type { DecomposeInput } from "./types.js";
import { createRuleBasedDecomposer } from "./rule-based.js";

const SYSTEM_PROMPT = `You are a senior engineering lead who breaks down product tickets into actionable development tasks.

Given a ticket (title, description) and optionally spec sections and acceptance criteria, produce a structured decomposition:

## Rules
- Each task must be a concrete, independently deliverable unit of work.
- Task IDs must be unique kebab-case strings (e.g. "setup-db-schema", "impl-auth-endpoint").
- Order tasks logically; earlier tasks should be prerequisites for later ones.
- Dependencies: only add a dependency when task B truly cannot start until task A is done. Parallel-safe tasks should NOT have dependencies between them.
- acceptance_criteria_refs: return IDs of acceptance criteria from the input that this decomposition covers.
- suggested_ac: if the ticket is missing obvious acceptance criteria (error handling, edge cases, performance), suggest them with new IDs following the pattern "{ticket}/ac/{n}".
- reasoning: briefly explain your decomposition strategy (1-3 sentences).

## Output quality
- Prefer 3-8 tasks for a typical feature ticket. Avoid single-task bundles unless the ticket is truly trivial.
- Task descriptions should be specific enough for a developer to start coding without re-reading the ticket.
- Do NOT repeat the ticket description verbatim; synthesize and refine.`;

function buildUserPrompt(input: DecomposeInput): string {
  const parts: string[] = [];

  parts.push(`# Ticket\n**Title:** ${input.ticket_title}\n**Description:** ${input.ticket_description}`);

  if (input.sections?.length) {
    parts.push("# Spec Sections");
    for (const s of input.sections) {
      parts.push(`## ${s.title}\n${s.body}`);
    }
  }

  if (input.acceptance_criteria.length) {
    parts.push("# Acceptance Criteria");
    for (const ac of input.acceptance_criteria) {
      parts.push(`- [${ac.id}] ${ac.description}`);
    }
  }

  return parts.join("\n\n");
}

export function createLlmDecomposer(model: LanguageModel): BundleDecomposer {
  const fallback = createRuleBasedDecomposer();

  return {
    async decompose(input: DecomposeInput): Promise<DecompositionResult> {
      try {
        const { object } = await generateObject({
          model,
          schema: DecompositionResultSchema,
          system: SYSTEM_PROMPT,
          prompt: buildUserPrompt(input),
          temperature: 0,
        });
        return object;
      } catch (err) {
        console.error("[ai-decomposer] LLM call failed, falling back to rule-based:", err);
        return fallback.decompose(input);
      }
    },
  };
}
