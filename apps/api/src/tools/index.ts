import { ToolRegistry } from "./registry.js";
import { bundleTools } from "./bundle-tools.js";
import { evidenceTools } from "./evidence-tools.js";
import { ticketTools } from "./ticket-tools.js";
import { createMemoryTools } from "./memory-tools.js";
import { PgMemoryProvider } from "../services/memory/pg-memory.js";

const memoryProvider = new PgMemoryProvider();

export const toolRegistry = new ToolRegistry()
  .register(bundleTools)
  .register(evidenceTools)
  .register(ticketTools)
  .register(createMemoryTools(memoryProvider));

export { memoryProvider };
export { ToolRegistry } from "./registry.js";
export type { ToolContext, ToolFactory } from "./types.js";
