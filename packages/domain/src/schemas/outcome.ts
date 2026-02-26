/**
 * RFC-005: KPI & Outcome Definition Schema
 * Outcome records, optional KPI definition, release attribution.
 */
import { z } from "zod";

export const OutcomeRecordSchema = z.object({
  id: z.string().optional(),
  release_id: z.string(),
  kpi_id: z.string().optional(),
  metric_name: z.string().optional(),
  value: z.number(),
  unit: z.string().optional(),
  aggregation: z.enum(["sum", "avg", "min", "max", "p50", "p95", "p99", "custom"]).optional(),
  window: z.string().optional(),
  timestamp: z.string().datetime(),
  comparison_previous_value: z.number().optional(),
  comparison_percent_change: z.number().optional(),
});

export const KpiDefinitionSchema = z.object({
  id: z.string(),
  metric_type: z.enum(["count", "rate", "percentage", "latency", "throughput", "custom"]),
  unit: z.string().optional(),
  aggregation: z.enum(["sum", "avg", "min", "max", "p50", "p95", "p99", "custom"]),
});

export type OutcomeRecord = z.infer<typeof OutcomeRecordSchema>;
export type KpiDefinition = z.infer<typeof KpiDefinitionSchema>;
