import { tool } from "ai";
import { z } from "zod";
import type { ToolFactory } from "./types.js";
import * as bundleStore from "../services/bundle-store.js";

export const bundleTools: ToolFactory = (ctx) => ({
  listBundles: tool({
    description:
      "List execution bundles in the current workspace. Optionally filter by ticket reference.",
    inputSchema: z.object({
      ticketRef: z
        .string()
        .optional()
        .describe("Filter by ticket reference (e.g. PROJ-42)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Max results to return (default 10)"),
    }),
    execute: async ({ ticketRef, limit }) => {
      if (ticketRef) {
        const bundles = await bundleStore.getBundlesByTicket(
          ctx.workspaceId,
          ticketRef,
        );
        return {
          bundles: bundles.slice(0, limit ?? 10).map((b) => ({
            id: b.id,
            title: b.title,
            ticketRef: b.ticket_ref,
            status: b.status,
            version: b.version,
            tasks: b.tasks.map((t) => ({ id: t.id, title: t.title })),
            createdAt: b.created_at,
          })),
          total: bundles.length,
        };
      }
      const result = await bundleStore.listBundles(ctx.workspaceId, {
        limit: limit ?? 10,
      });
      return {
        bundles: result.bundles.map((b) => ({
          id: b.id,
          title: b.title,
          ticketRef: b.ticket_ref,
          status: b.status,
          version: b.version,
          tasks: b.tasks.map((t) => ({ id: t.id, title: t.title })),
          createdAt: b.created_at,
        })),
        total: result.total,
      };
    },
  }),

  getBundle: tool({
    description: "Get detailed information about a specific execution bundle by its ID.",
    inputSchema: z.object({
      bundleId: z.string().uuid().describe("The bundle UUID"),
    }),
    execute: async ({ bundleId }) => {
      const bundle = await bundleStore.getBundle(bundleId);
      if (!bundle) return { error: "Bundle not found" };
      return {
        id: bundle.id,
        title: bundle.title,
        ticketRef: bundle.ticket_ref,
        specRef: bundle.spec_ref,
        status: bundle.status,
        version: bundle.version,
        tasks: bundle.tasks,
        dependencies: bundle.dependencies,
        acceptanceCriteriaRefs: bundle.acceptance_criteria_refs,
        createdAt: bundle.created_at,
        updatedAt: bundle.updated_at,
      };
    },
  }),

  createBundle: tool({
    description:
      "Create a new execution bundle from the user's idea. Decompose the idea into concrete tasks with titles and descriptions.",
    inputSchema: z.object({
      title: z
        .string()
        .describe("A concise, descriptive title for the bundle"),
      ticketRef: z
        .string()
        .describe("Ticket reference for the bundle (e.g. PROJ-42)"),
      specRef: z.string().optional().describe("Spec reference if available"),
      tasks: z
        .array(
          z.object({
            id: z.string().describe("Short task ID (e.g. T1, T2)"),
            title: z.string().describe("Concise task title"),
            description: z
              .string()
              .optional()
              .describe("Detailed task description"),
          }),
        )
        .min(1)
        .describe("List of tasks that make up the bundle"),
    }),
    execute: async ({ title, ticketRef, specRef, tasks }) => {
      const bundle = await bundleStore.createBundle({
        workspace_id: ctx.workspaceId,
        title,
        ticket_ref: ticketRef,
        spec_ref: specRef,
        tasks,
      });
      return {
        id: bundle.id,
        title: bundle.title,
        ticketRef: bundle.ticket_ref,
        status: bundle.status,
        version: bundle.version,
        tasks: bundle.tasks,
        createdAt: bundle.created_at,
      };
    },
  }),
});
