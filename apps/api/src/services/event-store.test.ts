import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/index.js", () => ({
  query: vi.fn(),
}));

vi.mock("./event-emitter.js", () => ({
  eventBus: { emit: vi.fn() },
}));

import { query } from "../db/index.js";
import { eventBus } from "./event-emitter.js";
import * as eventStore from "./event-store.js";

const mockQuery = query as ReturnType<typeof vi.fn>;
const mockEmit = eventBus.emit as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockQuery.mockReset();
  mockEmit.mockReset();
});

describe("createEvent", () => {
  it("inserts an event, emits it, and returns the row", async () => {
    const row = {
      id: "evt-1",
      workspace_id: "ws-1",
      type: "bundle.created",
      title: "Bundle created",
      detail: { ticketRef: "PROJ-10" },
      actor_id: "user-1",
      created_at: "2026-01-01T00:00:00Z",
    };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await eventStore.createEvent(
      "ws-1",
      "bundle.created",
      "Bundle created",
      { ticketRef: "PROJ-10" },
      "user-1",
    );

    expect(result).toEqual(row);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO workspace_events"),
      ["ws-1", "bundle.created", "Bundle created", '{"ticketRef":"PROJ-10"}', "user-1"],
    );
    expect(mockEmit).toHaveBeenCalledWith("event", row);
  });

  it("defaults actor_id to null when not provided", async () => {
    const row = {
      id: "evt-2",
      workspace_id: "ws-1",
      type: "evidence.submitted",
      title: "Evidence submitted",
      detail: {},
      actor_id: null,
      created_at: "2026-01-01T00:00:00Z",
    };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    await eventStore.createEvent("ws-1", "evidence.submitted", "Evidence submitted");
    expect(mockQuery.mock.calls[0][1]?.[4]).toBeNull();
  });
});

describe("listEvents", () => {
  it("returns events with total count", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: "3" }] })
      .mockResolvedValueOnce({
        rows: [
          { id: "evt-1", type: "bundle.created", title: "Bundle A" },
          { id: "evt-2", type: "bundle.created", title: "Bundle B" },
        ],
      });

    const result = await eventStore.listEvents("ws-1", { limit: 2, offset: 0 });
    expect(result.total).toBe(3);
    expect(result.events).toHaveLength(2);
  });

  it("applies type filter when provided", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: "1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "evt-1", type: "evidence.submitted" }] });

    await eventStore.listEvents("ws-1", { type: "evidence.submitted" });

    const countSql = mockQuery.mock.calls[0][0] as string;
    expect(countSql).toContain("type = $2");
    expect(mockQuery.mock.calls[0][1]).toContain("evidence.submitted");
  });

  it("applies since filter when provided", async () => {
    const since = "2026-02-01T00:00:00Z";
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: "5" }] })
      .mockResolvedValueOnce({ rows: [] });

    await eventStore.listEvents("ws-1", { since });

    const countSql = mockQuery.mock.calls[0][0] as string;
    expect(countSql).toContain("created_at > $2");
    expect(mockQuery.mock.calls[0][1]).toContain(since);
  });

  it("uses default limit and offset", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    await eventStore.listEvents("ws-1");

    const selectParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(selectParams).toContain(50);
    expect(selectParams).toContain(0);
  });
});

describe("getEvent", () => {
  it("returns event when found", async () => {
    const row = { id: "evt-1", workspace_id: "ws-1", type: "bundle.created", title: "A" };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await eventStore.getEvent("ws-1", "evt-1");
    expect(result).toEqual(row);
  });

  it("returns null when not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await eventStore.getEvent("ws-1", "nonexistent");
    expect(result).toBeNull();
  });
});
