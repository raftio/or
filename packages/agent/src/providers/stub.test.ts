import { describe, it, expect } from "vitest";
import { createStubChatAgent } from "./stub.js";

describe("createStubChatAgent", () => {
  it("returns a ChatAgent with a chat method", () => {
    const agent = createStubChatAgent();
    expect(agent).toHaveProperty("chat");
    expect(typeof agent.chat).toBe("function");
  });

  it("responds to a basic user message", async () => {
    const agent = createStubChatAgent();
    const result = await agent.chat({
      messages: [{ role: "user", content: "What can you do?" }],
    });

    expect(result).toBeDefined();
    const text = await result.text;
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });

  it("responds with hello variant for greetings", async () => {
    const agent = createStubChatAgent();
    const result = await agent.chat({
      messages: [{ role: "user", content: "hello there" }],
    });

    const text = await result.text;
    expect(text).toContain("Hello");
  });

  it("responds with help variant for help requests", async () => {
    const agent = createStubChatAgent();
    const result = await agent.chat({
      messages: [{ role: "user", content: "I need help" }],
    });

    const text = await result.text;
    expect(text).toContain("Bundles");
    expect(text).toContain("Evidence");
  });

  it("returns default response for unknown input", async () => {
    const agent = createStubChatAgent();
    const result = await agent.chat({
      messages: [{ role: "user", content: "tell me about quantum physics" }],
    });

    const text = await result.text;
    expect(text).toContain("stub mode");
  });

  it("produces a text stream response", async () => {
    const agent = createStubChatAgent();
    const result = await agent.chat({
      messages: [{ role: "user", content: "hello" }],
    });

    const response = result.toTextStreamResponse();
    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get("Content-Type")).toContain("text/plain");
  });

  it("produces a UI message stream response", async () => {
    const agent = createStubChatAgent();
    const result = await agent.chat({
      messages: [{ role: "user", content: "hello" }],
    });

    const response = result.toUIMessageStreamResponse();
    expect(response).toBeInstanceOf(Response);

    const body = await response.text();
    expect(body).toContain("0:");
    expect(body).toContain('d:{"finishReason":"stop"}');
  });

  it("ignores tools and maxSteps gracefully", async () => {
    const agent = createStubChatAgent();
    const result = await agent.chat({
      messages: [{ role: "user", content: "test" }],
      tools: {},
      maxSteps: 5,
    });

    const text = await result.text;
    expect(text).toContain("stub mode");
  });
});
