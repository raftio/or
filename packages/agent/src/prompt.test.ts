import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./prompt.js";

describe("buildSystemPrompt", () => {
  it("returns full prompt with all sections when no context is provided", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("OR Assistant");
    expect(prompt).toContain("execution bundles");
    expect(prompt).toContain("<communication>");
    expect(prompt).toContain("<flow>");
    expect(prompt).toContain("<tool_calling>");
    expect(prompt).toContain("<clarify_before_acting>");
    expect(prompt).not.toContain("Current Workspace Context");
    expect(prompt).not.toContain("Your Memory");
    expect(prompt).not.toContain("<mode>");
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

    expect(prompt).toContain("OR Assistant");
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
    expect(prompt).toContain("tickets");
  });

  it("includes tool usage guidelines", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("saveMemory");
    expect(prompt).toContain("recallMemories");
    expect(prompt).toContain("searchCode");
    expect(prompt).toContain("listBundles");
  });

  it("includes communication rules", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("concise and actionable");
    expect(prompt).toContain("never dump raw JSON");
  });

  it("includes flow instructions", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("discovery pass");
    expect(prompt).toContain("confirm details");
  });

  it("instructs parallel tool usage", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("parallel");
  });

  it("instructs not to mention tool names to user", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Do not mention tool names");
  });

  // ── Mode-specific tests ───────────────────────────────────────────────

  it("does not include mode section for agent mode", () => {
    const prompt = buildSystemPrompt(undefined, undefined, "agent");
    expect(prompt).not.toContain("<mode>");
  });

  it("includes ask mode instructions when mode is ask", () => {
    const prompt = buildSystemPrompt(undefined, undefined, "ask");
    expect(prompt).toContain("<mode>");
    expect(prompt).toContain("Ask mode");
    expect(prompt).toContain("read-only");
    expect(prompt).not.toContain("Plan mode");
  });

  it("includes plan mode instructions when mode is plan", () => {
    const prompt = buildSystemPrompt(undefined, undefined, "plan");
    expect(prompt).toContain("<mode>");
    expect(prompt).toContain("Plan mode");
    expect(prompt).toContain("collaborative planning");
    expect(prompt).not.toContain("Ask mode");
  });

  it("places mode section before memories and context", () => {
    const prompt = buildSystemPrompt("workspace data", "memory data", "ask");
    const modeIdx = prompt.indexOf("<mode>");
    const memIdx = prompt.indexOf("Your Memory");
    const ctxIdx = prompt.indexOf("Current Workspace Context");
    expect(modeIdx).toBeLessThan(memIdx);
    expect(modeIdx).toBeLessThan(ctxIdx);
  });

  it("ask mode instructs not to create or modify", () => {
    const prompt = buildSystemPrompt(undefined, undefined, "ask");
    expect(prompt).toContain("DO NOT create, modify, or delete");
  });

  it("plan mode instructs not to execute changes", () => {
    const prompt = buildSystemPrompt(undefined, undefined, "plan");
    expect(prompt).toContain("DO NOT execute changes");
  });

  it("ask mode redirects action requests to Agent mode", () => {
    const prompt = buildSystemPrompt(undefined, undefined, "ask");
    expect(prompt).toContain("Switch to **Agent** mode");
    expect(prompt).toContain("Do NOT gather details");
  });

  it("plan mode redirects action requests to Agent mode", () => {
    const prompt = buildSystemPrompt(undefined, undefined, "plan");
    expect(prompt).toContain("Switch to **Agent** mode");
    expect(prompt).toContain("Do NOT gather details");
  });

  it("ask mode instructs proactive multi-tool discovery", () => {
    const prompt = buildSystemPrompt(undefined, undefined, "ask");
    expect(prompt).toContain("Proactive discovery");
    expect(prompt).toContain("searchCode");
    expect(prompt).toContain("MULTIPLE tools in parallel");
  });

  it("plan mode instructs proactive multi-tool discovery", () => {
    const prompt = buildSystemPrompt(undefined, undefined, "plan");
    expect(prompt).toContain("Proactive discovery");
    expect(prompt).toContain("searchCode");
    expect(prompt).toContain("MULTIPLE tools in parallel");
  });
});
