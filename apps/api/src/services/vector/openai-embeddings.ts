import OpenAI from "openai";
import type { EmbeddingProvider } from "./contract.js";

const MODEL = "text-embedding-3-small";
const DIMENSIONS = 1536;
const MAX_BATCH = 100;

/** text-embedding-3-small limit: 8191 tokens (cl100k_base). */
const MAX_INPUT_CHARS = 30_000;

/**
 * Collapse whitespace to reduce token count without losing content.
 * Tabs/runs of spaces become a single space; blank lines are removed.
 * Truncate as a final safety net if still too long.
 */
function compact(text: string): string {
  const compacted = text
    .split("\n")
    .map((line) => line.replace(/\t/g, " ").replace(/ {2,}/g, " ").trimEnd())
    .filter((line) => line.length > 0)
    .join("\n");
  if (compacted.length <= MAX_INPUT_CHARS) return compacted;
  return compacted.slice(0, MAX_INPUT_CHARS);
}

export function createOpenAIEmbeddingProvider(apiKey: string): EmbeddingProvider {
  const client = new OpenAI({ apiKey });

  return {
    dimensions: DIMENSIONS,

    async embed(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];

      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += MAX_BATCH) {
        const batch = texts.slice(i, i + MAX_BATCH).map(compact);
        const response = await client.embeddings.create({
          model: MODEL,
          input: batch,
        });
        for (const item of response.data) {
          results.push(item.embedding);
        }
      }

      return results;
    },
  };
}
