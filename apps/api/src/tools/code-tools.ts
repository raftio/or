import { tool } from "ai";
import { z } from "zod";
import type { ToolFactory } from "./types.js";
import type { EmbeddingProvider, VectorStore } from "../services/vector/contract.js";
import { vectorQuery as dbQuery } from "../db/index.js";

export function createCodeTools(
  embeddingProvider: EmbeddingProvider,
  vectorStore: VectorStore,
): ToolFactory {
  return (ctx) => ({
    searchCode: tool({
      description:
        "Search the indexed codebase for relevant code snippets using semantic search. " +
        "Use when the user asks about code structure, implementation details, or where something is defined.",
      inputSchema: z.object({
        query: z.string().describe("Natural language description of what to find in the code"),
        limit: z.number().optional().default(5).describe("Max results to return"),
      }),
      execute: async ({ query: searchQuery, limit }) => {
        const repoResult = await dbQuery<{ repo: string }>(
          `SELECT repo FROM workspace_code_index_status
           WHERE workspace_id = $1 AND status = 'ready'
           LIMIT 1`,
          [ctx.workspaceId],
        );

        if (repoResult.rows.length === 0) {
          return { error: "No codebase has been indexed for this workspace yet." };
        }

        const repo = repoResult.rows[0].repo;
        const [embedding] = await embeddingProvider.embed([searchQuery]);

        const results = await vectorStore.search(embedding, {
          workspaceId: ctx.workspaceId,
          repo,
          limit,
        });

        if (results.length === 0) {
          return { message: "No relevant code found.", results: [] };
        }

        return {
          results: results.map((r) => ({
            file: r.filePath,
            lines: `${r.startLine}-${r.endLine}`,
            language: r.language,
            score: Math.round(r.score * 100) / 100,
            code: r.content,
          })),
        };
      },
    }),
  });
}
