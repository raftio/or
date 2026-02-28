import { tool } from "ai";
import { z } from "zod";
import type { ToolFactory } from "./types.js";
import type { MemoryProvider } from "../services/memory/types.js";

/**
 * Higher-order factory: inject the MemoryProvider, get back a ToolFactory.
 * This decouples tool definitions from the concrete storage implementation.
 */
export function createMemoryTools(memory: MemoryProvider): ToolFactory {
  return (ctx) => ({
    saveMemory: tool({
      description:
        "Save an important note, decision, preference, or context for future conversations. " +
        "Use this proactively when the user shares something worth remembering.",
      inputSchema: z.object({
        category: z
          .enum(["decision", "preference", "context", "summary"])
          .describe(
            "Category: 'decision' for choices made, 'preference' for user preferences, " +
            "'context' for background info, 'summary' for conversation summaries",
          ),
        content: z
          .string()
          .min(1)
          .describe("The memory content to save"),
      }),
      execute: async ({ category, content }) => {
        const entry = await memory.save({
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          category,
          content,
          sourceConversationId: ctx.conversationId,
        });
        return { saved: true, id: entry.id, category, content };
      },
    }),

    recallMemories: tool({
      description:
        "Search past memories by keyword. Use when the user asks about previous decisions, " +
        "preferences, or context from earlier conversations.",
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe("Keyword or phrase to search for in memories"),
      }),
      execute: async ({ query }) => {
        const entries = await memory.search(
          ctx.workspaceId,
          ctx.userId,
          query,
        );
        if (entries.length === 0) {
          return { found: false, message: "No matching memories found." };
        }
        return {
          found: true,
          memories: entries.map((e) => ({
            id: e.id,
            category: e.category,
            content: e.content,
            createdAt: e.createdAt,
          })),
        };
      },
    }),
  });
}
