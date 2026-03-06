import { describe, it, expect } from "vitest";
import { tool } from "ai";
import { z } from "zod";
import { ToolRegistry } from "./registry.js";
import type { ToolFactory, ToolContext } from "./types.js";

const echoFactory: ToolFactory = (ctx) => ({
  echo: tool({
    description: "Echo the workspace ID",
    inputSchema: z.object({}),
    execute: async () => ({ workspaceId: ctx.workspaceId }),
  }),
});

const greetFactory: ToolFactory = (ctx) => ({
  greet: tool({
    description: "Greet the user",
    inputSchema: z.object({ name: z.string() }),
    execute: async ({ name }) => ({ message: `Hello ${name} in ${ctx.workspaceId}` }),
  }),
});

describe("ToolRegistry", () => {
  it("builds an empty tool set with no factories", () => {
    const registry = new ToolRegistry();
    const tools = registry.build({ workspaceId: "ws-1", userId: "u-1" });
    expect(Object.keys(tools)).toHaveLength(0);
  });

  it("registers a single factory and builds tools", () => {
    const registry = new ToolRegistry().register(echoFactory);
    const tools = registry.build({ workspaceId: "ws-1", userId: "u-1" });
    expect(tools).toHaveProperty("echo");
  });

  it("merges tools from multiple factories", () => {
    const registry = new ToolRegistry()
      .register(echoFactory)
      .register(greetFactory);

    const tools = registry.build({ workspaceId: "ws-1", userId: "u-1" });
    expect(tools).toHaveProperty("echo");
    expect(tools).toHaveProperty("greet");
  });

  it("passes context to each factory", () => {
    const ctx: ToolContext = { workspaceId: "ws-42", userId: "u-7" };
    let capturedCtx: ToolContext | null = null;

    const spyFactory: ToolFactory = (c) => {
      capturedCtx = c;
      return {};
    };

    new ToolRegistry().register(spyFactory).build(ctx);
    expect(capturedCtx).toEqual(ctx);
  });

  it("supports chaining via register()", () => {
    const registry = new ToolRegistry();
    const result = registry.register(echoFactory);
    expect(result).toBe(registry);
  });
});
