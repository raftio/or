import { simulateReadableStream } from "ai";
import type { ChatAgent, ChatStreamResult } from "../contract.js";
import type { ChatInput } from "../types.js";

const STUB_RESPONSES: Record<string, string> = {
  default:
    "I'm the OR Assistant running in stub mode. To enable AI responses, configure an AI provider (OpenAI or Anthropic) in your workspace settings or environment variables.",
  hello:
    "Hello! I'm the OR Assistant. I can help you understand your execution bundles, evidence status, and workspace data. What would you like to know?",
  help: "Here's what I can help with:\n\n- **Bundles**: Understand tasks, dependencies, and acceptance criteria\n- **Evidence**: Check test results, coverage, and CI status\n- **Tickets**: Get guidance on decomposition and planning\n- **Integrations**: Understand your workspace setup\n\nAsk me anything about your workspace!",
};

function pickResponse(messages: ChatInput["messages"]): string {
  const raw = messages[messages.length - 1]?.content;
  const last = (typeof raw === "string" ? raw : "").toLowerCase();
  if (last.includes("hello") || last.includes("hi")) return STUB_RESPONSES.hello;
  if (last.includes("help")) return STUB_RESPONSES.help;
  return STUB_RESPONSES.default;
}

function buildTextStream(text: string) {
  const encoder = new TextEncoder();
  return simulateReadableStream({
    chunks: text.split(" ").map((word, i) => encoder.encode(i === 0 ? word : ` ${word}`)),
    initialDelayInMs: 0,
    chunkDelayInMs: 15,
  });
}

function toAsyncTextIterator(stream: ReadableStream<Uint8Array>) {
  return (async function* () {
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
  })();
}

export function createStubChatAgent(): ChatAgent {
  return {
    async chat(input: ChatInput) {
      const text = pickResponse(input.messages);
      const textStreamRaw = buildTextStream(text);
      const uiStreamRaw = buildTextStream(text);

      return {
        textStream: toAsyncTextIterator(textStreamRaw),
        text: Promise.resolve(text),
        toTextStreamResponse() {
          return new Response(textStreamRaw, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Transfer-Encoding": "chunked",
            },
          });
        },
        toUIMessageStreamResponse() {
          const encoder = new TextEncoder();
          const transform = new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
              const decoded = new TextDecoder().decode(chunk);
              controller.enqueue(encoder.encode(`0:${JSON.stringify(decoded)}\n`));
            },
            flush(controller) {
              controller.enqueue(encoder.encode(`d:{"finishReason":"stop"}\n`));
            },
          });
          uiStreamRaw.pipeTo(transform.writable).catch(() => {});
          return new Response(transform.readable, {
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
