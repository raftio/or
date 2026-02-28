import { streamText, stepCountIs } from "ai";
import type { LanguageModel } from "ai";
import type { ChatAgent } from "../contract.js";
import type { ChatInput } from "../types.js";
import { buildSystemPrompt } from "../prompt.js";

export function createModelChatAgent(model: LanguageModel): ChatAgent {
  return {
    async chat(input: ChatInput) {
      const maxSteps = input.maxSteps ?? 3;
      return streamText({
        model,
        system: buildSystemPrompt(input.systemContext, input.memoriesContext),
        messages: input.messages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
        tools: input.tools,
        stopWhen: stepCountIs(maxSteps),
      });
    },
  };
}
