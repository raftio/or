import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/index.js", () => ({
  query: vi.fn(),
}));

import { query } from "../db/index.js";
import { buildChatContext } from "./chat-context.js";

const mockQuery = query as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("buildChatContext", () => {
  it("returns empty string when workspace has no bundles or evidence", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const context = await buildChatContext("ws-1");
    expect(context).toBe("");
  });

  it("includes bundle summaries when bundles exist", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: "b-1",
            ticket_ref: "PROJ-42",
            version: 1,
            tasks: [
              { id: "setup-db", title: "Set up database schema" },
              { id: "impl-api", title: "Implement API endpoints" },
            ],
            created_at: "2026-01-15T10:00:00Z",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const context = await buildChatContext("ws-1");
    expect(context).toContain("Recent Bundles");
    expect(context).toContain("PROJ-42");
    expect(context).toContain("setup-db");
    expect(context).toContain("impl-api");
  });

  it("includes evidence summaries when evidence exists", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            ticket_id: "PROJ-42",
            ci_status: "success",
            test_results: { pass: 10, fail: 0 },
            timestamp: "2026-01-15T12:00:00Z",
          },
        ],
      });

    const context = await buildChatContext("ws-1");
    expect(context).toContain("Recent Evidence");
    expect(context).toContain("PROJ-42");
    expect(context).toContain("success");
    expect(context).toContain("10 pass");
  });

  it("includes both bundles and evidence when both exist", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: "b-1",
          ticket_ref: "PROJ-1",
          version: 2,
          tasks: [{ id: "t1", title: "Task 1" }],
          created_at: "2026-01-01T00:00:00Z",
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          ticket_id: "PROJ-1",
          ci_status: "failure",
          test_results: { pass: 5, fail: 2 },
          timestamp: "2026-01-02T00:00:00Z",
        }],
      });

    const context = await buildChatContext("ws-1");
    expect(context).toContain("Recent Bundles");
    expect(context).toContain("Recent Evidence");
  });

  it("truncates tasks beyond 5", async () => {
    const tasks = Array.from({ length: 8 }, (_, i) => ({
      id: `task-${i}`,
      title: `Task ${i}`,
    }));
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: "b-1",
          ticket_ref: "PROJ-1",
          version: 1,
          tasks,
          created_at: "2026-01-01T00:00:00Z",
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const context = await buildChatContext("ws-1");
    expect(context).toContain("task-0");
    expect(context).toContain("task-4");
    expect(context).toContain("3 more tasks");
    expect(context).not.toContain("task-5: Task 5");
  });

  it("handles DB errors gracefully", async () => {
    mockQuery
      .mockRejectedValueOnce(new Error("connection refused"))
      .mockRejectedValueOnce(new Error("connection refused"));

    const context = await buildChatContext("ws-1");
    expect(context).toBe("");
  });
});
