import { streamText, stepCountIs } from "ai";
import type { LanguageModel, ModelMessage } from "ai";
import type { ChatAgent } from "../contract.js";
import type { ChatInput } from "../types.js";
import { buildSystemPrompt } from "../prompt.js";

export function createModelChatAgent(model: LanguageModel): ChatAgent {
  return {
    async chat(input: ChatInput) {
      const maxSteps = input.maxSteps ?? 3;
      // Content can be a plain string or an array of multimodal parts;
      // the Vercel AI SDK handles both via CoreMessage.
      const messages = input.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })) as ModelMessage[];

      return streamText({
        model,
        system: buildSystemPrompt(input.systemContext, input.memoriesContext, input.mode),
        messages,
        tools: input.tools,
        stopWhen: stepCountIs(maxSteps),
      });
    },
  };
}
