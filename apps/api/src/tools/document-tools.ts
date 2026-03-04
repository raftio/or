import { tool } from "ai";
import { z } from "zod";
import type { ToolFactory } from "./types.js";
import { createDocumentProviderForWorkspace } from "../adapters/document/index.js";

export const documentTools: ToolFactory = (ctx) => ({
  getDocument: tool({
    description:
      "Fetch and analyze a spec or document from the connected document provider (Notion or Confluence). " +
      "Accepts a page URL (including Confluence short links like /wiki/x/...), a Notion page ID, or a numeric Confluence page ID.",
    inputSchema: z.object({
      ref: z
        .string()
        .describe(
          "The document reference — a full URL, a Confluence short link, a numeric page ID, or a Notion page ID",
        ),
    }),
    execute: async ({ ref }) => {
      const provider = await createDocumentProviderForWorkspace(
        ctx.workspaceId,
      );
      try {
        const doc = await provider.getDocument(ref);
        if (!doc) return { error: "Document not found" };
        return doc;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to fetch document";
        return { error: msg };
      }
    },
  }),
});
