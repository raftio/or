import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/index.js", () => ({
  query: vi.fn(),
}));

import { query } from "../db/index.js";
import * as chatImageStore from "./chat-image-store.js";

const mockQuery = query as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockQuery.mockReset();
});

describe("validateImage", () => {
  it("accepts JPEG images under 5 MB", () => {
    const result = chatImageStore.validateImage("image/jpeg", 1024);
    expect(result).toEqual({ ok: true });
  });

  it("accepts PNG images under 5 MB", () => {
    const result = chatImageStore.validateImage("image/png", 2 * 1024 * 1024);
    expect(result).toEqual({ ok: true });
  });

  it("rejects non-image types", () => {
    const result = chatImageStore.validateImage("image/gif", 1024);
    expect(result).toEqual({ ok: false, error: "Only JPEG and PNG images are allowed" });
  });

  it("rejects application/pdf", () => {
    const result = chatImageStore.validateImage("application/pdf", 1024);
    expect(result).toEqual({ ok: false, error: "Only JPEG and PNG images are allowed" });
  });

  it("rejects images over 5 MB", () => {
    const size = 6 * 1024 * 1024;
    const result = chatImageStore.validateImage("image/png", size);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain("5 MB limit");
  });

  it("accepts images at exactly 5 MB", () => {
    const result = chatImageStore.validateImage("image/jpeg", 5 * 1024 * 1024);
    expect(result).toEqual({ ok: true });
  });
});

describe("saveImage", () => {
  it("inserts and returns metadata (without data)", async () => {
    const row = {
      id: "img-1",
      workspace_id: "ws-1",
      user_id: "user-1",
      filename: "photo.jpg",
      content_type: "image/jpeg",
      size_bytes: 2048,
      created_at: "2026-01-01T00:00:00Z",
    };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const data = Buffer.from("fake-image-data");
    const result = await chatImageStore.saveImage("ws-1", "user-1", "photo.jpg", "image/jpeg", data);

    expect(result).toEqual(row);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO workspace_chat_images"),
      ["ws-1", "user-1", "photo.jpg", "image/jpeg", data.length, data],
    );
  });
});

describe("getImage", () => {
  it("returns image with data when found", async () => {
    const row = {
      id: "img-1",
      workspace_id: "ws-1",
      user_id: "user-1",
      filename: "photo.jpg",
      content_type: "image/jpeg",
      size_bytes: 2048,
      data: Buffer.from("binary-data"),
      created_at: "2026-01-01T00:00:00Z",
    };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await chatImageStore.getImage("img-1");
    expect(result).toEqual(row);
    expect(result?.data).toBeInstanceOf(Buffer);
  });

  it("returns null when not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await chatImageStore.getImage("nonexistent");
    expect(result).toBeNull();
  });
});

describe("getImageMetadata", () => {
  it("returns metadata without data", async () => {
    const row = {
      id: "img-1",
      workspace_id: "ws-1",
      user_id: "user-1",
      filename: "photo.jpg",
      content_type: "image/jpeg",
      size_bytes: 2048,
      created_at: "2026-01-01T00:00:00Z",
    };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await chatImageStore.getImageMetadata("img-1");
    expect(result).toEqual(row);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.not.stringContaining("data"),
      ["img-1"],
    );
  });

  it("returns null when not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await chatImageStore.getImageMetadata("nonexistent");
    expect(result).toBeNull();
  });
});
