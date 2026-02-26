/**
 * RFC-004: Evidence Payload Format
 * Test results, coverage, CI logs, validation signals; lifecycle states.
 */
import { z } from "zod";

export const EvidenceLifecycleSchema = z.enum([
  "created",
  "validated",
  "linked",
]);

export const TestResultsSchema = z.object({
  pass: z.number(),
  fail: z.number(),
  skip: z.number().optional(),
  failed_test_names: z.array(z.string()).optional(),
  failed_test_ids: z.array(z.string()).optional(),
});

export const CoverageSchema = z
  .object({
    line_pct: z.number().optional(),
    branch_pct: z.number().optional(),
    per_file: z.record(z.number()).optional(),
  })
  .optional();

export const EvidencePayloadSchema = z.object({
  id: z.string().optional(),
  repo: z.string(),
  branch: z.string().optional(),
  commit_sha: z.string().optional(),
  pr_id: z.string().optional(),
  ticket_id: z.string(),
  test_results: TestResultsSchema,
  coverage: CoverageSchema,
  ci_logs: z.string().optional(),
  validation_signals: z
    .array(
      z.object({
        name: z.string(),
        passed: z.boolean(),
      })
    )
    .optional(),
  ci_status: z.enum(["success", "failure", "cancelled"]),
  artifact_urls: z.array(z.string().url()).optional(),
  timestamp: z.string().datetime(),
  lifecycle: EvidenceLifecycleSchema.optional(),
  bundle_id: z.string().optional(),
  bundle_version: z.number().optional(),
});

export type EvidencePayload = z.infer<typeof EvidencePayloadSchema>;
export type EvidenceLifecycle = z.infer<typeof EvidenceLifecycleSchema>;
export type TestResults = z.infer<typeof TestResultsSchema>;
export type Coverage = z.infer<typeof CoverageSchema>;
