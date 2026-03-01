import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/index.js", () => ({
  query: vi.fn(),
}));

import { query } from "../db/index.js";
import * as bundleStore from "./bundle-store.js";

const mockQuery = query as ReturnType<typeof vi.fn>;

const makeBundleRow = (overrides: Record<string, unknown> = {}) => ({
  id: "bundle-1",
  workspace_id: "ws-1",
  ticket_ref: "PROJ-10",
  title: "Add user auth",
  spec_ref: "",
  version: 1,
  content_hash: "abc123",
  status: "active" as const,
  tasks: [{ id: "t1", title: "Task 1" }],
  dependencies: null,
  acceptance_criteria_refs: [],
  context: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  mockQuery.mockReset();
});

describe("updateBundleStatus", () => {
  it("updates status to completed and returns the bundle", async () => {
    const row = makeBundleRow({ status: "completed" });
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

    const result = await bundleStore.updateBundleStatus("ws-1", "bundle-1", "completed");

    expect(result).toBeDefined();
    expect(result!.status).toBe("completed");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE workspace_bundles"),
      ["completed", "bundle-1", "ws-1"],
    );
  });

  it("updates status back to active", async () => {
    const row = makeBundleRow({ status: "active" });
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

    const result = await bundleStore.updateBundleStatus("ws-1", "bundle-1", "active");

    expect(result).toBeDefined();
    expect(result!.status).toBe("active");
  });

  it("returns undefined when bundle not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await bundleStore.updateBundleStatus("ws-1", "nonexistent", "completed");

    expect(result).toBeUndefined();
  });

  it("sets updated_at to now()", async () => {
    const row = makeBundleRow({ status: "completed" });
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

    await bundleStore.updateBundleStatus("ws-1", "bundle-1", "completed");

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("updated_at = now()");
  });
});

describe("getBundle", () => {
  it("returns a bundle with status field", async () => {
    const row = makeBundleRow({ id: "bundle-get-1" });
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

    const result = await bundleStore.getBundle("bundle-get-1");

    expect(result).toBeDefined();
    expect(result!.status).toBe("active");
  });
});

describe("createBundle", () => {
  it("returns a bundle that includes status and title", async () => {
    const row = makeBundleRow();
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

    const result = await bundleStore.createBundle({
      workspace_id: "ws-1",
      ticket_ref: "PROJ-10",
      title: "Add user auth",
    });

    expect(result.status).toBe("active");
    expect(result.title).toBe("Add user auth");
  });

  it("defaults title to empty string when not provided", async () => {
    const row = makeBundleRow({ title: "" });
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

    const result = await bundleStore.createBundle({
      workspace_id: "ws-1",
      ticket_ref: "PROJ-10",
    });

    expect(result.title).toBe("");
  });
});
