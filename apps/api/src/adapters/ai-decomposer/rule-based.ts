/**
 * Deterministic rule-based decomposer (original bundling-engine logic).
 * Used as fallback when AI is disabled or unavailable.
 */
import type { DecompositionResult } from "@or/domain";
import type { BundleDecomposer } from "./contract.js";
import type { DecomposeInput } from "./types.js";

export function createRuleBasedDecomposer(): BundleDecomposer {
  return {
    async decompose(input: DecomposeInput): Promise<DecompositionResult> {
      const tasks = input.sections?.length
        ? input.sections.map((s) => ({
            id: s.id,
            title: s.title,
            description: s.body,
          }))
        : [
            {
              id: "task-1",
              title: input.ticket_title,
              description: input.ticket_description,
            },
          ];

      const acceptance_criteria_refs = input.acceptance_criteria.map(
        (ac) => ac.id,
      );

      const dependencies =
        tasks.length > 1
          ? Array.from({ length: tasks.length - 1 }, (_, i) => ({
              taskId: tasks[i + 1]!.id,
              dependsOn: tasks[i]!.id,
            }))
          : null;

      return {
        tasks,
        dependencies,
        acceptance_criteria_refs,
        suggested_ac: null,
        reasoning: null,
      };
    },
  };
}
