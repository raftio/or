import { ToolRegistry } from "./registry.js";
import { bundleTools } from "./bundle-tools.js";
import { evidenceTools } from "./evidence-tools.js";
import { ticketTools } from "./ticket-tools.js";
import { createMemoryTools } from "./memory-tools.js";
import { createCodeTools } from "./code-tools.js";
import { PgMemoryProvider } from "../services/memory/pg-memory.js";
import { createPgVectorStore, createOpenAIEmbeddingProvider } from "../services/vector/index.js";
import { getOpenAiApiKey } from "../config.js";

const memoryProvider = new PgMemoryProvider();
const vectorStore = createPgVectorStore();
const openAiKey = getOpenAiApiKey();
const embeddingProvider = openAiKey
  ? createOpenAIEmbeddingProvider(openAiKey)
  : null;

const registry = new ToolRegistry()
  .register(bundleTools)
  .register(evidenceTools)
  .register(ticketTools)
  .register(createMemoryTools(memoryProvider));

if (embeddingProvider) {
  registry.register(createCodeTools(embeddingProvider, vectorStore));
}

export const toolRegistry = registry;
export { memoryProvider, vectorStore, embeddingProvider };
export { ToolRegistry } from "./registry.js";
export type { ToolContext, ToolFactory } from "./types.js";
