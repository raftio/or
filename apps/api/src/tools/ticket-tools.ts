import { tool } from "ai";
import { z } from "zod";
import type { ToolFactory } from "./types.js";
import { createTicketProviderForWorkspace } from "../adapters/ticket/index.js";

export const ticketTools: ToolFactory = (ctx) => ({
  getTicket: tool({
    description:
      "Get details of a specific ticket/issue by its ID or key (e.g. PROJ-42, #12).",
    inputSchema: z.object({
      ticketId: z.string().describe("The ticket ID or key"),
    }),
    execute: async ({ ticketId }) => {
      const provider = await createTicketProviderForWorkspace(ctx.workspaceId);
      const ticket = await provider.getTicket(ticketId);
      if (!ticket) return { error: "Ticket not found" };
      return ticket;
    },
  }),

  listTickets: tool({
    description:
      "List tickets/issues from the connected ticket provider. Supports filtering by project or search query.",
    inputSchema: z.object({
      project: z
        .string()
        .optional()
        .describe("Filter by project key or name"),
      query: z
        .string()
        .optional()
        .describe("Search query to filter tickets"),
    }),
    execute: async ({ project, query }) => {
      const provider = await createTicketProviderForWorkspace(ctx.workspaceId);
      if (!provider.listTickets) {
        return {
          error:
            "Connected ticket provider does not support listing tickets",
        };
      }
      const tickets = await provider.listTickets({ project, query });
      return { tickets, total: tickets.length };
    },
  }),

  createTicket: tool({
    description:
      "Create a new ticket/issue in the connected ticket provider. Only use after confirming with the user.",
    inputSchema: z.object({
      title: z.string().describe("Ticket title"),
      description: z
        .string()
        .optional()
        .describe("Detailed ticket description"),
      labels: z
        .array(z.string())
        .optional()
        .describe("Labels/tags to apply"),
    }),
    execute: async ({ title, description, labels }) => {
      const provider = await createTicketProviderForWorkspace(ctx.workspaceId);
      if (!provider.createTicket) {
        return {
          error:
            "Connected ticket provider does not support creating tickets",
        };
      }
      return provider.createTicket({ title, description, labels });
    },
  }),

  addComment: tool({
    description:
      "Add a comment to an existing ticket/issue. Only use after confirming with the user.",
    inputSchema: z.object({
      ticketId: z.string().describe("The ticket ID or key (e.g. PROJ-42)"),
      body: z.string().describe("The comment text to add"),
    }),
    execute: async ({ ticketId, body }) => {
      const provider = await createTicketProviderForWorkspace(ctx.workspaceId);
      if (!provider.addComment) {
        return {
          error:
            "Connected ticket provider does not support adding comments",
        };
      }
      try {
        const result = await provider.addComment(ticketId, body);
        return { ok: true, commentId: result.id };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to add comment";
        return { error: msg };
      }
    },
  }),
});
