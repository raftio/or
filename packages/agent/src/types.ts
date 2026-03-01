import type { LanguageModel, ToolSet } from "ai";

export type TextPart = { type: "text"; text: string };
export type ImagePart = { type: "image"; image: string | Uint8Array | Buffer | ArrayBuffer | URL };
export type ContentPart = TextPart | ImagePart;

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string | ContentPart[];
}

export interface ChatInput {
  messages: ChatMessage[];
  systemContext?: string;
  memoriesContext?: string;
  tools?: ToolSet;
  maxSteps?: number;
}

export type ChatProviderType = "stub" | "openai" | "anthropic";

export interface ChatAgentConfig {
  provider: ChatProviderType;
  model?: LanguageModel;
  modelName?: string;
  apiKey?: string;
}
