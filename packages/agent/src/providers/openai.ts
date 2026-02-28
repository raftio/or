import { streamText } from "ai";
import type { LanguageModel } from "ai";
import type { ChatAgent } from "../contract.js";
import type { ChatInput } from "../types.js";
import { buildSystemPrompt } from "../prompt.js";

export function createOpenAiChatAgent(model: LanguageModel): ChatAgent {
  return {
    async chat(input: ChatInput) {
      return streamText({
        model,
        system: buildSystemPrompt(input.systemContext),
        messages: input.messages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
      });
    },
  };
}
