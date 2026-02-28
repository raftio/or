import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./prompt.js";

describe("buildSystemPrompt", () => {
  it("returns base persona when no context is provided", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Orca Assistant");
    expect(prompt).toContain("execution bundles");
    expect(prompt).not.toContain("Current Workspace Context");
  });

  it("returns base persona when context is empty string", () => {
    const prompt = buildSystemPrompt("");
    expect(prompt).not.toContain("Current Workspace Context");
  });

  it("returns base persona when context is whitespace", () => {
    const prompt = buildSystemPrompt("   ");
    expect(prompt).not.toContain("Current Workspace Context");
  });

  it("appends workspace context when provided", () => {
    const context = "### Recent Bundles (3)\n\n- PROJ-1 (v1)";
    const prompt = buildSystemPrompt(context);

    expect(prompt).toContain("Orca Assistant");
    expect(prompt).toContain("Current Workspace Context");
    expect(prompt).toContain("PROJ-1");
  });

  it("includes key capability descriptions", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("evidence");
    expect(prompt).toContain("acceptance criteria");
    expect(prompt).toContain("ticket decomposition");
  });
});
