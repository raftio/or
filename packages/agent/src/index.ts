export { createChatAgent } from "./providers/index.js";
export { createStubChatAgent } from "./providers/stub.js";
export { createOpenAiChatAgent } from "./providers/openai.js";
export { createAnthropicChatAgent } from "./providers/anthropic.js";
export { buildSystemPrompt } from "./prompt.js";

export type { ChatAgent, ChatStreamResult } from "./contract.js";
export type { ChatInput, ChatMessage, ChatAgentConfig, ChatProviderType } from "./types.js";
