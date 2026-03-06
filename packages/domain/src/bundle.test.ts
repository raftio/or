import { describe, it, expect } from "vitest";
import { ExecutionBundleSchema, BundleStatusSchema } from "./bundle.js";

describe("BundleStatusSchema", () => {
  it("accepts 'active'", () => {
    expect(BundleStatusSchema.parse("active")).toBe("active");
  });

  it("accepts 'completed'", () => {
    expect(BundleStatusSchema.parse("completed")).toBe("completed");
  });

  it("rejects invalid status values", () => {
    expect(() => BundleStatusSchema.parse("deleted")).toThrow();
    expect(() => BundleStatusSchema.parse("")).toThrow();
    expect(() => BundleStatusSchema.parse(123)).toThrow();
  });
});

describe("ExecutionBundleSchema", () => {
  const validBundle = {
    id: "bundle-1",
    version: 1,
    title: "Add user auth",
    spec_ref: "spec-1",
    ticket_ref: "PROJ-10",
    status: "active",
    tasks: [{ id: "t1", title: "Task 1" }],
    acceptance_criteria_refs: ["ac-1"],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  it("parses a valid bundle with active status", () => {
    const result = ExecutionBundleSchema.parse(validBundle);
    expect(result.status).toBe("active");
  });

  it("parses a valid bundle with completed status", () => {
    const result = ExecutionBundleSchema.parse({ ...validBundle, status: "completed" });
    expect(result.status).toBe("completed");
  });

  it("rejects a bundle with invalid status", () => {
    expect(() =>
      ExecutionBundleSchema.parse({ ...validBundle, status: "archived" }),
    ).toThrow();
  });

  it("rejects a bundle without status", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, ...noStatus } = validBundle;
    expect(() => ExecutionBundleSchema.parse(noStatus)).toThrow();
  });
});
