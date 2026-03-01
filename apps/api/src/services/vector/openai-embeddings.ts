import OpenAI from "openai";
import type { EmbeddingProvider } from "./contract.js";

const MODEL = "text-embedding-3-small";
const DIMENSIONS = 1536;
const MAX_BATCH = 100;

export function createOpenAIEmbeddingProvider(apiKey: string): EmbeddingProvider {
  const client = new OpenAI({ apiKey });

  return {
    dimensions: DIMENSIONS,

    async embed(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];

      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += MAX_BATCH) {
        const batch = texts.slice(i, i + MAX_BATCH);
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
