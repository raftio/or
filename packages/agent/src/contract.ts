import type { streamText } from "ai";
import type { ChatInput } from "./types.js";

export type ChatStreamResult = Awaited<ReturnType<typeof streamText>>;

export interface ChatAgent {
  chat(input: ChatInput): Promise<ChatStreamResult>;
}
