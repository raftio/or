/**
 * RFC-002: Execution Bundle Schema
 */
import { z } from "zod";

const BundleTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
});

const DependenciesSchema = z
  .array(
    z.object({
      taskId: z.string(),
      dependsOn: z.string(),
    })
  )
  .optional();

export const BundleStatusSchema = z.enum(["active", "completed"]);
export type BundleStatus = z.infer<typeof BundleStatusSchema>;

export const ExecutionBundleSchema = z.object({
  id: z.string(),
  version: z.number(),
  title: z.string(),
  spec_ref: z.string(),
  ticket_ref: z.string(),
  status: BundleStatusSchema,
  tasks: z.array(BundleTaskSchema),
  dependencies: DependenciesSchema,
  acceptance_criteria_refs: z.array(z.string()),
  context: z
    .object({
      excerpts: z.array(z.string()).optional(),
      related_ticket_ids: z.array(z.string()).optional(),
    })
    .optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  ext: z.record(z.unknown()).optional(),
  meta: z.record(z.unknown()).optional(),
});

export type ExecutionBundle = z.infer<typeof ExecutionBundleSchema>;
export type BundleTask = z.infer<typeof BundleTaskSchema>;
