import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/index.js", () => ({
  query: vi.fn(),
}));

import { query } from "../db/index.js";
import * as chatStore from "./chat-store.js";

const mockQuery = query as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockQuery.mockReset();
});

describe("createConversation", () => {
  it("inserts a conversation and returns it", async () => {
    const row = {
      id: "conv-1",
      workspace_id: "ws-1",
      user_id: "user-1",
      title: "My Chat",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await chatStore.createConversation("ws-1", "user-1", "My Chat");
    expect(result).toEqual(row);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO workspace_chat_conversations"),
      ["ws-1", "user-1", "My Chat"],
    );
  });

  it("uses default title when none provided", async () => {
    const row = {
      id: "conv-2",
      workspace_id: "ws-1",
      user_id: "user-1",
      title: "New conversation",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    await chatStore.createConversation("ws-1", "user-1");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      ["ws-1", "user-1", "New conversation"],
    );
  });
});

describe("getConversation", () => {
  it("returns the conversation when found", async () => {
    const row = { id: "conv-1", workspace_id: "ws-1", user_id: "user-1", title: "Chat", created_at: "", updated_at: "" };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await chatStore.getConversation("conv-1");
    expect(result).toEqual(row);
  });

  it("returns null when not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await chatStore.getConversation("nonexistent");
    expect(result).toBeNull();
  });
});

describe("listConversations", () => {
  it("returns conversations with total count", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: "2" }] })
      .mockResolvedValueOnce({
        rows: [
          { id: "conv-1", title: "Chat 1" },
          { id: "conv-2", title: "Chat 2" },
        ],
      });

    const result = await chatStore.listConversations("ws-1", "user-1", 10, 0);
    expect(result.total).toBe(2);
    expect(result.conversations).toHaveLength(2);
  });
});

describe("deleteConversation", () => {
  it("returns true when a row was deleted", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const result = await chatStore.deleteConversation("conv-1");
    expect(result).toBe(true);
  });

  it("returns false when no row was deleted", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });

    const result = await chatStore.deleteConversation("nonexistent");
    expect(result).toBe(false);
  });
});

describe("addMessage", () => {
  it("inserts a message and touches conversation updated_at", async () => {
    const msgRow = {
      id: "msg-1",
      conversation_id: "conv-1",
      role: "user",
      content: "Hello",
      created_at: "2026-01-01T00:00:00Z",
    };
    mockQuery
      .mockResolvedValueOnce({ rows: [msgRow] })
      .mockResolvedValueOnce({});

    const result = await chatStore.addMessage("conv-1", "user", "Hello");
    expect(result).toEqual(msgRow);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls[1][0]).toContain("UPDATE workspace_chat_conversations");
  });
});

describe("getMessages", () => {
  it("returns messages ordered by created_at", async () => {
    const messages = [
      { id: "msg-1", conversation_id: "conv-1", role: "user", content: "Hi", created_at: "2026-01-01T00:00:00Z" },
      { id: "msg-2", conversation_id: "conv-1", role: "assistant", content: "Hello!", created_at: "2026-01-01T00:00:01Z" },
    ];
    mockQuery.mockResolvedValueOnce({ rows: messages });

    const result = await chatStore.getMessages("conv-1");
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
  });
});
