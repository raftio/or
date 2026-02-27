/**
 * RFC-003: Acceptance Criteria Model
 */
import { z } from "zod";

export const VerificationConditionSchema = z
  .object({
    assertion_type: z.enum(["test_pass", "coverage_threshold", "manual"]),
    test_reference: z.string().optional(),
    parameters: z.record(z.unknown()).optional(),
  })
  .optional();

export const RequirementRefSchema = z.object({
  ticket_id: z.string().optional(),
  spec_document_id: z.string().optional(),
  spec_fragment_id: z.string().optional(),
});

export const AcceptanceCriterionSchema = z.object({
  id: z.string(),
  description: z.string(),
  verification_condition: VerificationConditionSchema,
  requirement_ref: RequirementRefSchema,
  source: z.enum(["ticket", "spec", "derived"]),
});

export const AcceptanceCriteriaArraySchema = z.array(AcceptanceCriterionSchema);

export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;
export type RequirementRef = z.infer<typeof RequirementRefSchema>;
export type VerificationCondition = z.infer<typeof VerificationConditionSchema>;
