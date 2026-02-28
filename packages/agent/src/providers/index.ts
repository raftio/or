import type { ChatAgent } from "../contract.js";
import type { ChatAgentConfig } from "../types.js";
import { createStubChatAgent } from "./stub.js";
import { createOpenAiChatAgent } from "./openai.js";
import { createAnthropicChatAgent } from "./anthropic.js";

/**
 * Create a chat agent from config. When a pre-built LanguageModel is supplied
 * (e.g. from workspace integrations), it is used directly. Otherwise the
 * factory creates one from apiKey + modelName.
 */
export async function createChatAgent(config: ChatAgentConfig): Promise<ChatAgent> {
  if (config.model) {
    switch (config.provider) {
      case "openai":
        return createOpenAiChatAgent(config.model);
      case "anthropic":
        return createAnthropicChatAgent(config.model);
      default:
        return createStubChatAgent();
    }
  }

  if (config.provider === "openai") {
    if (!config.apiKey) {
      console.warn("[ai-chat-agent] No API key for OpenAI, falling back to stub");
      return createStubChatAgent();
    }
    const { createOpenAI } = await import("@ai-sdk/openai");
    const provider = createOpenAI({ apiKey: config.apiKey });
    return createOpenAiChatAgent(provider(config.modelName || "gpt-4o-mini"));
  }

  if (config.provider === "anthropic") {
    if (!config.apiKey) {
      console.warn("[ai-chat-agent] No API key for Anthropic, falling back to stub");
      return createStubChatAgent();
    }
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    const provider = createAnthropic({ apiKey: config.apiKey });
    return createAnthropicChatAgent(provider(config.modelName || "claude-sonnet-4-20250514"));
  }

  return createStubChatAgent();
}
