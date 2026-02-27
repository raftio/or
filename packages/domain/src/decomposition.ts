/**
 * AI Bundle Decomposer – structured output schema.
 * Shared between domain validation and AI generateObject() calls.
 *
 * Uses .nullable() instead of .optional() for OpenAI structured output
 * compatibility: all properties must appear in the JSON schema's `required`
 * array, but their values may be null.
 */
import { z } from "zod";

const DecompositionTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
});

const DecompositionDependencySchema = z.object({
  taskId: z.string(),
  dependsOn: z.string(),
});

const SuggestedAcSchema = z.object({
  id: z.string(),
  description: z.string(),
});

export const DecompositionResultSchema = z.object({
  tasks: z.array(DecompositionTaskSchema).min(1),
  dependencies: z.array(DecompositionDependencySchema).nullable(),
  acceptance_criteria_refs: z.array(z.string()),
  suggested_ac: z.array(SuggestedAcSchema).nullable(),
  reasoning: z.string().nullable(),
});

export type DecompositionResult = z.infer<typeof DecompositionResultSchema>;
