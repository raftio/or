import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createConfluenceDocumentProvider,
  testConfluenceConnection,
  ConfluencePermissionError,
} from "./confluence.js";

const BASE_URL = "https://team.atlassian.net/wiki";
const EMAIL = "user@example.com";
const TOKEN = "confluence_test_token_abc123";

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(
    (input, init) => Promise.resolve(handler(String(input), init)),
  );
}

function confluencePage(
  title: string,
  storageHtml: string,
  when = "2025-08-01T10:00:00.000Z",
) {
  return {
    id: "123456",
    title,
    body: { storage: { value: storageHtml } },
    version: { when },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── createConfluenceDocumentProvider ─────────────────────────────────────

describe("createConfluenceDocumentProvider", () => {
  it("returns SpecDocumentDto for a valid page", async () => {
    const html = `
      <h1>Overview</h1>
      <p>This is the overview.</p>
      <h2>Details</h2>
      <p>Some details here.</p>
    `;
    mockFetch(() => Response.json(confluencePage("My Spec", html)));

    const provider = createConfluenceDocumentProvider(BASE_URL, EMAIL, TOKEN);
    const doc = await provider.getDocument("123456");

    expect(doc).not.toBeNull();
    expect(doc!.ref).toBe("123456");
    expect(doc!.title).toBe("My Spec");
    expect(doc!.updated_at).toBe("2025-08-01T10:00:00.000Z");
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
    const html = `
      <p>Intro paragraph.</p>
      <p>Another paragraph.</p>
      <h1>Section A</h1>
      <p>Section A content.</p>
    `;
    mockFetch(() => Response.json(confluencePage("Doc", html)));

    const provider = createConfluenceDocumentProvider(BASE_URL, EMAIL, TOKEN);
    const doc = await provider.getDocument("123456");

    expect(doc!.sections).toHaveLength(2);
    expect(doc!.sections[0].title).toBe("Content");
    expect(doc!.sections[0].body).toContain("Intro paragraph.");
    expect(doc!.sections[0].body).toContain("Another paragraph.");
    expect(doc!.sections[1].title).toBe("Section A");
  });

  it("creates a single section when there are no headings", async () => {
    const html = `<p>Just text.</p><p>A bullet.</p>`;
    mockFetch(() => Response.json(confluencePage("Flat Doc", html)));

    const provider = createConfluenceDocumentProvider(BASE_URL, EMAIL, TOKEN);
    const doc = await provider.getDocument("123456");

    expect(doc!.sections).toHaveLength(1);
    expect(doc!.sections[0].title).toBe("Content");
    expect(doc!.sections[0].body).toContain("Just text.");
  });

  it("returns null on 404", async () => {
    mockFetch(() => new Response(null, { status: 404 }));

    const provider = createConfluenceDocumentProvider(BASE_URL, EMAIL, TOKEN);
    const doc = await provider.getDocument("nonexistent");

    expect(doc).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network failure"));

    const provider = createConfluenceDocumentProvider(BASE_URL, EMAIL, TOKEN);
    const doc = await provider.getDocument("123456");

    expect(doc).toBeNull();
  });

  it("throws ConfluencePermissionError on 403", async () => {
    mockFetch(() => new Response("Forbidden", { status: 403 }));

    const provider = createConfluenceDocumentProvider(BASE_URL, EMAIL, TOKEN);
    await expect(provider.getDocument("123456")).rejects.toThrow(ConfluencePermissionError);
  });

  it("extracts page id from a Confluence URL", async () => {
    const html = `<h1>Spec</h1><p>Content.</p>`;
    const spy = mockFetch(() => Response.json(confluencePage("Spec", html)));

    const provider = createConfluenceDocumentProvider(BASE_URL, EMAIL, TOKEN);
    await provider.getDocument(
      "https://team.atlassian.net/wiki/spaces/PROJ/pages/123456/My+Page",
    );

    expect(spy.mock.calls[0][0]).toContain("/rest/api/content/123456");
  });

  it("resolves a Confluence short link (/wiki/x/...) via redirect chain", async () => {
    const html = `<h1>Spec</h1><p>Short link content.</p>`;
    let callCount = 0;
    const spy = mockFetch((url) => {
      callCount++;
      if (url.includes("/wiki/x/hAJtug")) {
        const finalUrl = "https://team.atlassian.net/wiki/spaces/PROJ/pages/789012/Resolved+Page";
        const res = new Response("<html></html>", { status: 200 });
        Object.defineProperty(res, "url", { value: finalUrl });
        return res;
      }
      return Response.json(confluencePage("Resolved Page", html));
    });

    const provider = createConfluenceDocumentProvider(BASE_URL, EMAIL, TOKEN);
    const doc = await provider.getDocument(
      "https://team.atlassian.net/wiki/x/hAJtug",
    );

    expect(callCount).toBe(2);
    expect(doc).not.toBeNull();
    expect(doc!.title).toBe("Resolved Page");
    expect(doc!.ref).toBe("789012");
    const contentCall = spy.mock.calls[1][0] as string;
    expect(contentCall).toContain("/rest/api/content/789012");
  });

  it("returns null when short link final URL has no page id", async () => {
    mockFetch((url) => {
      if (url.includes("/wiki/x/")) {
        const res = new Response("<html></html>", { status: 200 });
        Object.defineProperty(res, "url", { value: "https://team.atlassian.net/wiki/unknown" });
        return res;
      }
      return new Response(null, { status: 404 });
    });

    const provider = createConfluenceDocumentProvider(BASE_URL, EMAIL, TOKEN);
    const doc = await provider.getDocument(
      "https://team.atlassian.net/wiki/x/badLink",
    );

    expect(doc).toBeNull();
  });

  it("sends correct Basic Auth header", async () => {
    const html = `<p>text</p>`;
    const spy = mockFetch(() => Response.json(confluencePage("Doc", html)));

    const provider = createConfluenceDocumentProvider(BASE_URL, EMAIL, TOKEN);
    await provider.getDocument("123456");

    const firstCall = spy.mock.calls[0];
    const headers = firstCall[1]?.headers as Record<string, string>;
    const expected = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
    expect(headers["Authorization"]).toBe(`Basic ${expected}`);
  });

  it("retries on 429 and succeeds", async () => {
    let callCount = 0;
    const html = `<p>Content</p>`;
    mockFetch(() => {
      callCount++;
      if (callCount === 1) {
        return new Response("Rate limited", {
          status: 429,
          headers: { "Retry-After": "0" },
        });
      }
      return Response.json(confluencePage("Doc", html));
    });

    const provider = createConfluenceDocumentProvider(BASE_URL, EMAIL, TOKEN);
    const doc = await provider.getDocument("123456");

    expect(callCount).toBe(2);
    expect(doc).not.toBeNull();
    expect(doc!.title).toBe("Doc");
  });

  it("normalises base URL trailing slash", async () => {
    const html = `<p>text</p>`;
    const spy = mockFetch(() => Response.json(confluencePage("Doc", html)));

    const provider = createConfluenceDocumentProvider(BASE_URL + "///", EMAIL, TOKEN);
    await provider.getDocument("42");

    expect(spy.mock.calls[0][0]).toMatch(
      /^https:\/\/team\.atlassian\.net\/wiki\/rest\/api\/content\/42/,
    );
  });
});

// ── Acceptance criteria extraction ──────────────────────────────────────

describe("acceptance criteria extraction", () => {
  it("extracts AC from a dedicated Acceptance Criteria section", async () => {
    const html = `
      <h1>Overview</h1>
      <p>Overview text.</p>
      <h2>Acceptance Criteria</h2>
      <p>- Users can log in with SSO</p>
      <p>- Password reset emails are sent within 30s</p>
      <p>- Admin dashboard shows active sessions</p>
    `;
    mockFetch(() => Response.json(confluencePage("Login Spec", html)));

    const provider = createConfluenceDocumentProvider(BASE_URL, EMAIL, TOKEN);
    const doc = await provider.getDocument("99");

    expect(doc!.acceptance_criteria).toHaveLength(3);
    expect(doc!.acceptance_criteria![0]).toEqual({
      id: "99/ac/1",
      description: "Users can log in with SSO",
    });
    expect(doc!.acceptance_criteria![2].description).toBe(
      "Admin dashboard shows active sessions",
    );
  });

  it("extracts inline AC lines starting with 'AC:'", async () => {
    const html = `
      <h1>Feature</h1>
      <p>Some feature description.</p>
      <p>AC: The API returns 200 on success</p>
      <p>AC: Error responses include a message field</p>
    `;
    mockFetch(() => Response.json(confluencePage("API Spec", html)));

    const provider = createConfluenceDocumentProvider(BASE_URL, EMAIL, TOKEN);
    const doc = await provider.getDocument("55");

    expect(doc!.acceptance_criteria).toHaveLength(2);
    expect(doc!.acceptance_criteria![0].description).toBe(
      "The API returns 200 on success",
    );
  });

  it("returns undefined acceptance_criteria when none are found", async () => {
    const html = `<h1>Simple</h1><p>No criteria here.</p>`;
    mockFetch(() => Response.json(confluencePage("Simple", html)));

    const provider = createConfluenceDocumentProvider(BASE_URL, EMAIL, TOKEN);
    const doc = await provider.getDocument("77");

    expect(doc!.acceptance_criteria).toBeUndefined();
  });
});

// ── testConfluenceConnection ────────────────────────────────────────────

describe("testConfluenceConnection", () => {
  it("returns user display name on success", async () => {
    mockFetch(() => Response.json({ displayName: "Jane Doe" }));

    const result = await testConfluenceConnection(BASE_URL, EMAIL, TOKEN);
    expect(result).toEqual({ name: "Jane Doe" });
  });

  it("throws on 401", async () => {
    mockFetch(() => new Response("Unauthorized", { status: 401 }));

    await expect(testConfluenceConnection(BASE_URL, EMAIL, TOKEN)).rejects.toThrow(
      "Invalid credentials",
    );
  });

  it("throws with status on other errors", async () => {
    mockFetch(() => new Response("Server Error", { status: 500 }));

    await expect(testConfluenceConnection(BASE_URL, EMAIL, TOKEN)).rejects.toThrow("500");
  });
});
