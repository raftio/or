import { describe, it, expect } from "vitest";
import { createChatAgent } from "./index.js";

describe("createChatAgent factory", () => {
  it("returns a stub agent when provider is stub", async () => {
    const agent = await createChatAgent({ provider: "stub" });
    expect(agent).toBeDefined();
    expect(typeof agent.chat).toBe("function");

    const result = await agent.chat({
      messages: [{ role: "user", content: "test" }],
    });
    const text = await result.text;
    expect(text).toContain("stub mode");
  });

  it("falls back to stub when openai has no API key", async () => {
    const agent = await createChatAgent({ provider: "openai" });
    expect(agent).toBeDefined();

    const result = await agent.chat({
      messages: [{ role: "user", content: "test" }],
    });
    const text = await result.text;
    expect(text).toContain("stub mode");
  });

  it("falls back to stub when anthropic has no API key", async () => {
    const agent = await createChatAgent({ provider: "anthropic" });
    expect(agent).toBeDefined();

    const result = await agent.chat({
      messages: [{ role: "user", content: "test" }],
    });
    const text = await result.text;
    expect(text).toContain("stub mode");
  });

  it("returns stub for unrecognized provider", async () => {
    const agent = await createChatAgent({ provider: "stub" });
    expect(agent).toBeDefined();
  });
});
