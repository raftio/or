import type { LanguageModel } from "ai";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatInput {
  messages: ChatMessage[];
  systemContext?: string;
}

export type ChatProviderType = "stub" | "openai" | "anthropic";

export interface ChatAgentConfig {
  provider: ChatProviderType;
  model?: LanguageModel;
  modelName?: string;
  apiKey?: string;
}
