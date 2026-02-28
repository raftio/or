import { simulateReadableStream } from "ai";
import type { ChatAgent, ChatStreamResult } from "../contract.js";
import type { ChatInput } from "../types.js";

const STUB_RESPONSES: Record<string, string> = {
  default:
    "I'm the Orca Assistant running in stub mode. To enable AI responses, configure an AI provider (OpenAI or Anthropic) in your workspace settings or environment variables.",
  hello:
    "Hello! I'm the Orca Assistant. I can help you understand your execution bundles, evidence status, and workspace data. What would you like to know?",
  help: "Here's what I can help with:\n\n- **Bundles**: Understand tasks, dependencies, and acceptance criteria\n- **Evidence**: Check test results, coverage, and CI status\n- **Tickets**: Get guidance on decomposition and planning\n- **Integrations**: Understand your workspace setup\n\nAsk me anything about your workspace!",
};

function pickResponse(messages: ChatInput["messages"]): string {
  const last = messages[messages.length - 1]?.content?.toLowerCase() ?? "";
  if (last.includes("hello") || last.includes("hi")) return STUB_RESPONSES.hello;
  if (last.includes("help")) return STUB_RESPONSES.help;
  return STUB_RESPONSES.default;
}

export function createStubChatAgent(): ChatAgent {
  return {
    async chat(input: ChatInput) {
      const text = pickResponse(input.messages);
      const encoder = new TextEncoder();
      const stream = simulateReadableStream({
        chunks: text.split(" ").map((word, i) => encoder.encode(i === 0 ? word : ` ${word}`)),
        initialDelayInMs: 0,
        chunkDelayInMs: 15,
      });

      return {
        textStream: (async function* () {
          const decoder = new TextDecoder();
          const reader = stream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              yield decoder.decode(value);
            }
          } finally {
            reader.releaseLock();
          }
        })(),
        text: Promise.resolve(text),
        toTextStreamResponse() {
          return new Response(stream, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Transfer-Encoding": "chunked",
            },
          });
        },
      } as unknown as ChatStreamResult;
    },
  };
}
