import OpenAI from "openai";
import type { EmbeddingProvider } from "./contract.js";

const MODEL = "text-embedding-3-small";
const DIMENSIONS = 1536;
const MAX_BATCH = 100;

/**
 * text-embedding-3-small limit: 8191 tokens (cl100k_base).
 * Proto/code identifiers average ~2.5 chars/token, so use a conservative limit.
 */
const MAX_INPUT_CHARS = 20_000;
const HARD_LIMIT_CHARS = 14_000;

/**
 * Collapse whitespace to reduce token count without losing content.
 * Tabs/runs of spaces become a single space; blank lines are removed.
 */
function compact(text: string, charLimit = MAX_INPUT_CHARS): string {
  const compacted = text
    .split("\n")
    .map((line) => line.replace(/\t/g, " ").replace(/ {2,}/g, " ").trimEnd())
    .filter((line) => line.length > 0)
    .join("\n");
  if (compacted.length <= charLimit) return compacted;
  return compacted.slice(0, charLimit);
}

function isTokenLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("maximum context length") || msg.includes("too many tokens");
}

export function createOpenAIEmbeddingProvider(apiKey: string): EmbeddingProvider {
  const client = new OpenAI({ apiKey });

  async function embedBatch(texts: string[]): Promise<number[][]> {
    const response = await client.embeddings.create({
      model: MODEL,
      input: texts,
    });
    return response.data.map((item) => item.embedding);
  }

  return {
    dimensions: DIMENSIONS,

    async embed(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];

      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += MAX_BATCH) {
        const batch = texts.slice(i, i + MAX_BATCH).map((t) => compact(t));

        try {
          const embeddings = await embedBatch(batch);
          results.push(...embeddings);
        } catch (err) {
          if (!isTokenLimitError(err)) throw err;

          // Batch failed due to token limit — retry each item individually
          // with a more aggressive char limit
          for (const text of batch) {
            try {
              const [embedding] = await embedBatch([text]);
              results.push(embedding);
            } catch (retryErr) {
              if (!isTokenLimitError(retryErr)) throw retryErr;
              const truncated = compact(text, HARD_LIMIT_CHARS);
              const [embedding] = await embedBatch([truncated]);
              results.push(embedding);
            }
          }
        }
      }

      return results;
    },
  };
}
