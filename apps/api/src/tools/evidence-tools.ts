import { tool } from "ai";
import { z } from "zod";
import type { ToolFactory } from "./types.js";
import * as evidenceStore from "../services/evidence-store.js";

export const evidenceTools: ToolFactory = (ctx) => ({
  listEvidence: tool({
    description:
      "List evidence payloads in the workspace. Optionally filter by ticket ID or bundle ID.",
    inputSchema: z.object({
      ticketId: z
        .string()
        .optional()
        .describe("Filter by ticket ID (e.g. PROJ-42)"),
      bundleId: z.string().optional().describe("Filter by bundle ID"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Max results (default 10)"),
    }),
    execute: async ({ ticketId, bundleId, limit }) => {
      if (ticketId) {
        const payloads = await evidenceStore.getEvidenceByTicket(
          ctx.workspaceId,
          ticketId,
        );
        return {
          evidence: payloads.slice(0, limit ?? 10).map(summarize),
          total: payloads.length,
        };
      }
      if (bundleId) {
        const payloads = await evidenceStore.getEvidenceByBundle(
          ctx.workspaceId,
          bundleId,
        );
        return {
          evidence: payloads.slice(0, limit ?? 10).map(summarize),
          total: payloads.length,
        };
      }
      const result = await evidenceStore.listEvidence(ctx.workspaceId, {
        limit: limit ?? 10,
      });
      return {
        evidence: result.evidence.map(summarize),
        total: result.total,
      };
    },
  }),

  getEvidenceStatus: tool({
    description:
      "Check if evidence is complete for a given ticket. Returns whether CI has passed and the list of evidence payloads.",
    inputSchema: z.object({
      ticketId: z.string().describe("The ticket ID to check evidence for"),
    }),
    execute: async ({ ticketId }) => {
      const status = await evidenceStore.getEvidenceStatus(
        ctx.workspaceId,
        ticketId,
      );
      return {
        ticketId,
        complete: status.complete,
        payloadCount: status.payloads.length,
        payloads: status.payloads.slice(0, 5).map(summarize),
      };
    },
  }),
});

function summarize(e: evidenceStore.StoredEvidence) {
  return {
    id: e.id,
    ticketId: e.ticket_id,
    repo: e.repo,
    ciStatus: e.ci_status,
    testResults: e.test_results,
    timestamp: e.timestamp,
  };
}
