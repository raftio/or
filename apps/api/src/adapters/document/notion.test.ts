import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNotionDocumentProvider, testNotionConnection } from "./notion.js";

const TOKEN = "ntn_test_token_abc123";

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(
    (input, init) => Promise.resolve(handler(String(input), init)),
  );
}

function notionPage(title: string, lastEdited = "2025-06-01T12:00:00.000Z") {
  return {
    id: "page-1",
    properties: {
      title: {
        type: "title",
        title: [{ plain_text: title }],
      },
    },
    last_edited_time: lastEdited,
  };
}

function notionBlocks(blocks: Array<{ type: string; text: string }>) {
  return {
    results: blocks.map((b, i) => ({
      id: `block-${i}`,
      type: b.type,
      [b.type]: { rich_text: [{ plain_text: b.text }] },
    })),
    has_more: false,
    next_cursor: null,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("createNotionDocumentProvider", () => {
  it("returns SpecDocumentDto for a valid page", async () => {
    mockFetch((url) => {
      if (url.includes("/pages/")) {
        return Response.json(notionPage("My Document"));
      }
      return Response.json(
        notionBlocks([
          { type: "heading_1", text: "Overview" },
          { type: "paragraph", text: "This is the overview." },
          { type: "heading_2", text: "Details" },
          { type: "paragraph", text: "Some details here." },
        ]),
      );
    });

    const provider = createNotionDocumentProvider(TOKEN);
    const doc = await provider.getDocument("page-1");

    expect(doc).not.toBeNull();
    expect(doc!.ref).toBe("page-1");
    expect(doc!.title).toBe("My Document");
    expect(doc!.updated_at).toBe("2025-06-01T12:00:00.000Z");
    expect(doc!.sections).toHaveLength(2);
    expect(doc!.sections[0]).toEqual({
      id: "s1",
      title: "Overview",
      body: "This is the overview.",
    });
    expect(doc!.sections[1]).toEqual({
      id: "s2",
      title: "Details",
      body: "Some details here.",
    });
  });

  it("groups content before first heading into a default section", async () => {
    mockFetch((url) => {
      if (url.includes("/pages/")) {
        return Response.json(notionPage("Doc"));
      }
      return Response.json(
        notionBlocks([
          { type: "paragraph", text: "Intro paragraph." },
          { type: "paragraph", text: "Another paragraph." },
          { type: "heading_1", text: "Section A" },
          { type: "paragraph", text: "Section A content." },
        ]),
      );
    });

    const provider = createNotionDocumentProvider(TOKEN);
    const doc = await provider.getDocument("page-2");

    expect(doc!.sections).toHaveLength(2);
    expect(doc!.sections[0].title).toBe("Content");
    expect(doc!.sections[0].body).toBe("Intro paragraph.\nAnother paragraph.");
    expect(doc!.sections[1].title).toBe("Section A");
  });

  it("returns null on 404", async () => {
    mockFetch(() => new Response(null, { status: 404 }));

    const provider = createNotionDocumentProvider(TOKEN);
    const doc = await provider.getDocument("nonexistent");

    expect(doc).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network failure"));

    const provider = createNotionDocumentProvider(TOKEN);
    const doc = await provider.getDocument("page-1");

    expect(doc).toBeNull();
  });

  it("creates a single section when there are no headings", async () => {
    mockFetch((url) => {
      if (url.includes("/pages/")) {
        return Response.json(notionPage("Flat Doc"));
      }
      return Response.json(
        notionBlocks([
          { type: "paragraph", text: "Just text." },
          { type: "bulleted_list_item", text: "A bullet." },
        ]),
      );
    });

    const provider = createNotionDocumentProvider(TOKEN);
    const doc = await provider.getDocument("page-3");

    expect(doc!.sections).toHaveLength(1);
    expect(doc!.sections[0].title).toBe("Content");
    expect(doc!.sections[0].body).toBe("Just text.\nA bullet.");
  });

  it("sends correct authorization and version headers", async () => {
    const spy = mockFetch((url) => {
      if (url.includes("/pages/")) {
        return Response.json(notionPage("Doc"));
      }
      return Response.json(notionBlocks([]));
    });

    const provider = createNotionDocumentProvider(TOKEN);
    await provider.getDocument("page-1");

    const firstCall = spy.mock.calls[0];
    const headers = firstCall[1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${TOKEN}`);
    expect(headers["Notion-Version"]).toBe("2022-06-28");
  });
});

describe("testNotionConnection", () => {
  it("returns bot name on success", async () => {
    mockFetch(() => Response.json({ name: "My Integration" }));

    const result = await testNotionConnection(TOKEN);
    expect(result).toEqual({ name: "My Integration" });
  });

  it("throws on 401", async () => {
    mockFetch(() => new Response("Unauthorized", { status: 401 }));

    await expect(testNotionConnection(TOKEN)).rejects.toThrow(
      "Invalid token",
    );
  });

  it("throws with status on other errors", async () => {
    mockFetch(() => new Response("Server Error", { status: 500 }));

    await expect(testNotionConnection(TOKEN)).rejects.toThrow("500");
  });
});
