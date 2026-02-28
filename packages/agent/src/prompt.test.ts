import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./prompt.js";

describe("buildSystemPrompt", () => {
  it("returns base persona + tool guidelines when no context is provided", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Orca Assistant");
    expect(prompt).toContain("execution bundles");
    expect(prompt).toContain("Tool Usage");
    expect(prompt).not.toContain("Current Workspace Context");
    expect(prompt).not.toContain("Your Memory");
  });

  it("returns base when context is empty string", () => {
    const prompt = buildSystemPrompt("");
    expect(prompt).not.toContain("Current Workspace Context");
  });

  it("returns base when context is whitespace", () => {
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

  it("appends memories section when provided", () => {
    const prompt = buildSystemPrompt(undefined, "[decision] Use React for frontend");

    expect(prompt).toContain("Your Memory");
    expect(prompt).toContain("Use React for frontend");
    expect(prompt).not.toContain("Current Workspace Context");
  });

  it("includes both memories and workspace context", () => {
    const prompt = buildSystemPrompt(
      "### Recent Bundles (1)\n\n- PROJ-1",
      "[preference] Dark mode preferred",
    );

    expect(prompt).toContain("Your Memory");
    expect(prompt).toContain("Dark mode preferred");
    expect(prompt).toContain("Current Workspace Context");
    expect(prompt).toContain("PROJ-1");
  });

  it("places memories before workspace context", () => {
    const prompt = buildSystemPrompt("workspace data", "memory data");
    const memIdx = prompt.indexOf("Your Memory");
    const ctxIdx = prompt.indexOf("Current Workspace Context");
    expect(memIdx).toBeLessThan(ctxIdx);
  });

  it("includes key capability descriptions", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("evidence");
    expect(prompt).toContain("acceptance criteria");
    expect(prompt).toContain("ticket decomposition");
  });

  it("includes tool usage guidelines", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("saveMemory");
    expect(prompt).toContain("recallMemories");
    expect(prompt).toContain("confirm destructive actions");
  });
});
