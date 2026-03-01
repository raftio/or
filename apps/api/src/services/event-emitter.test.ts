import { describe, it, expect, beforeEach } from "vitest";
import { eventBus, type WorkspaceEvent } from "./event-emitter.js";

function makeEvent(overrides: Partial<WorkspaceEvent> = {}): WorkspaceEvent {
  return {
    id: "evt-1",
    workspace_id: "ws-1",
    type: "bundle.created",
    title: "Bundle created",
    detail: {},
    actor_id: "user-1",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("WorkspaceEventBus", () => {
  beforeEach(() => {
    eventBus.removeAllListeners();
  });

  it("emits events to listeners", () => {
    const received: WorkspaceEvent[] = [];
    eventBus.on("event", (e) => received.push(e));

    const event = makeEvent();
    eventBus.emit("event", event);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(event);
  });

  it("supports multiple listeners", () => {
    let count = 0;
    eventBus.on("event", () => count++);
    eventBus.on("event", () => count++);

    eventBus.emit("event", makeEvent());

    expect(count).toBe(2);
  });

  it("stops delivering after off()", () => {
    const received: WorkspaceEvent[] = [];
    const handler = (e: WorkspaceEvent) => received.push(e);
    eventBus.on("event", handler);

    eventBus.emit("event", makeEvent({ id: "evt-1" }));
    eventBus.off("event", handler);
    eventBus.emit("event", makeEvent({ id: "evt-2" }));

    expect(received).toHaveLength(1);
  });

  describe("connection tracking", () => {
    it("tracks and removes connections per workspace", () => {
      eventBus.trackConnection("ws-1", "conn-a");
      eventBus.trackConnection("ws-1", "conn-b");
      eventBus.trackConnection("ws-2", "conn-c");

      expect(eventBus.getConnectionCount("ws-1")).toBe(2);
      expect(eventBus.getConnectionCount("ws-2")).toBe(1);
      expect(eventBus.getConnectionCount()).toBe(3);

      eventBus.removeConnection("ws-1", "conn-a");
      expect(eventBus.getConnectionCount("ws-1")).toBe(1);

      eventBus.removeConnection("ws-1", "conn-b");
      expect(eventBus.getConnectionCount("ws-1")).toBe(0);

      eventBus.removeConnection("ws-2", "conn-c");
      expect(eventBus.getConnectionCount()).toBe(0);
    });

    it("returns 0 for unknown workspace", () => {
      expect(eventBus.getConnectionCount("unknown")).toBe(0);
    });

    it("lists workspace IDs with active connections", () => {
      eventBus.trackConnection("ws-1", "conn-a");
      eventBus.trackConnection("ws-2", "conn-b");

      const ids = eventBus.getWorkspaceIds();
      expect(ids).toContain("ws-1");
      expect(ids).toContain("ws-2");

      eventBus.removeConnection("ws-1", "conn-a");
      expect(eventBus.getWorkspaceIds()).not.toContain("ws-1");
    });

    it("handles removing non-existent connections gracefully", () => {
      expect(() => eventBus.removeConnection("ws-1", "nonexistent")).not.toThrow();
    });
  });
});
