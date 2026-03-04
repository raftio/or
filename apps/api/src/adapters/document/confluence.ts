/**
 * RFC-010: Confluence document provider – fetches pages via Confluence Cloud REST API.
 * Auth: Basic Auth (email + API token).
 *
 * Implements:
 *  - Fetch specs/docs by reference (page id or URL)  [RFC-010 §2.1]
 *  - Sections → tasks mapping input                   [RFC-010 §2.2, RFC-002]
 *  - AC extraction from spec content                  [RFC-010 §2.2, RFC-003]
 *  - Sync & permissions (rate-limit retry, permission errors) [RFC-010 §2.3]
 */
import type { DocumentProvider } from "./contract.js";
import type {
  SpecDocumentDto,
  SpecSectionDto,
  SpecAcceptanceCriterionDto,
} from "./types.js";

// ── Confluence API types ────────────────────────────────────────────────

interface ConfluenceContentResponse {
  id: string;
  title: string;
  body?: {
    storage?: { value: string };
  };
  version?: { when?: string };
}

// ── Ref parsing ─────────────────────────────────────────────────────────

const CONFLUENCE_URL_PAGE_ID_RE = /\/pages\/(\d+)/;
const CONFLUENCE_SHORT_LINK_RE = /\/wiki\/x\/([A-Za-z0-9_-]+)\s*$/;

type ResolvedRef =
  | { kind: "id"; value: string }
  | { kind: "shortLink"; url: string };

function resolveRef(ref: string): ResolvedRef {
  const trimmed = ref.trim();
  if (/^\d+$/.test(trimmed)) return { kind: "id", value: trimmed };

  const pageMatch = CONFLUENCE_URL_PAGE_ID_RE.exec(trimmed);
  if (pageMatch) return { kind: "id", value: pageMatch[1] };

  if (CONFLUENCE_SHORT_LINK_RE.test(trimmed)) {
    return { kind: "shortLink", url: trimmed };
  }

  return { kind: "id", value: trimmed };
}

/**
 * Resolve a Confluence short link (/wiki/x/{tinyId}) to a numeric page id.
 * Short links return a 302 redirect to the full page URL which contains the
 * numeric page id in its path.
 */
async function resolveShortLink(
  shortLinkUrl: string,
  headers: Record<string, string>,
): Promise<string | null> {
  try {
    const res = await fetch(shortLinkUrl, { headers });
    const match = CONFLUENCE_URL_PAGE_ID_RE.exec(res.url);
    if (match) return match[1];
  } catch { /* network error — fall through */ }
  return null;
}

// ── XHTML storage-format parsing ────────────────────────────────────────

const HEADING_RE = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
const STRIP_TAGS_RE = /<[^>]+>/g;

function stripTags(html: string): string {
  return html.replace(STRIP_TAGS_RE, "").trim();
}

/**
 * Split Confluence storage-format XHTML into sections by h1/h2/h3 headings.
 * Content before the first heading is placed in a "Content" section.
 * Mirrors the Notion adapter's `blocksToSections` behaviour.
 */
function storageToSections(html: string): SpecSectionDto[] {
  const sections: SpecSectionDto[] = [];

  const headings: Array<{ title: string; index: number }> = [];
  let m: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((m = HEADING_RE.exec(html)) !== null) {
    headings.push({ title: stripTags(m[2]) || "Untitled Section", index: m.index });
  }

  if (headings.length === 0) {
    const body = stripTags(html);
    return [{ id: "s1", title: "Content", body }];
  }

  const preHeadingBody = stripTags(html.slice(0, headings[0].index));
  let sectionIndex = 0;

  if (preHeadingBody) {
    sections.push({ id: `s${++sectionIndex}`, title: "Content", body: preHeadingBody });
  }

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : html.length;
    const fragment = html.slice(start, end);

    const withoutHeading = fragment.replace(HEADING_RE, "");
    const body = stripTags(withoutHeading);

    sections.push({ id: `s${++sectionIndex}`, title: headings[i].title, body });
  }

  return sections;
}

// ── AC extraction (RFC-003) ─────────────────────────────────────────────

const AC_SECTION_TITLES = [
  "acceptance criteria",
  "acceptance criterion",
  "ac",
];

const AC_LINE_RE = /^[-*•]\s*(.+)/;

/**
 * Extract acceptance criteria from sections.
 *
 * Strategy (RFC-010 §2.2, RFC-003):
 *  1. If a section title matches known AC headings, each bullet/line item
 *     becomes a structured AC with `source: "spec"`.
 *  2. Individual lines starting with "AC:" anywhere are also captured.
 */
function extractAcceptanceCriteria(
  sections: SpecSectionDto[],
  pageId: string,
): SpecAcceptanceCriterionDto[] {
  const criteria: SpecAcceptanceCriterionDto[] = [];
  let localId = 0;

  for (const section of sections) {
    const isAcSection = AC_SECTION_TITLES.includes(section.title.toLowerCase().trim());

    const lines = section.body.split("\n").map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      if (isAcSection) {
        const bullet = AC_LINE_RE.exec(line);
        const desc = bullet ? bullet[1].trim() : line;
        if (desc) {
          criteria.push({ id: `${pageId}/ac/${++localId}`, description: desc });
        }
      } else if (line.toLowerCase().startsWith("ac:")) {
        const desc = line.slice(3).trim();
        if (desc) {
          criteria.push({ id: `${pageId}/ac/${++localId}`, description: desc });
        }
      }
    }
  }

  return criteria;
}

// ── HTTP helpers (RFC-010 §2.3: auth, permissions, rate limits) ─────────

function makeHeaders(email: string, apiToken: string): Record<string, string> {
  const credentials = Buffer.from(`${email}:${apiToken}`).toString("base64");
  return {
    Authorization: `Basic ${credentials}`,
    Accept: "application/json",
  };
}

const MAX_RETRIES = 2;
const RATE_LIMIT_BACKOFF_MS = 1000;

/**
 * Fetch with rate-limit retry (RFC-010 §2.3).
 * On 429 the adapter waits using the Retry-After header (or a default backoff)
 * and retries up to MAX_RETRIES times.
 * On 403 it throws a permission error so the caller can surface "no access".
 */
async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
): Promise<Response> {
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, { headers });

    if (res.status === 403) {
      throw new ConfluencePermissionError(
        "No access — the configured identity cannot read this Confluence page",
      );
    }

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = res.headers.get("Retry-After");
      const waitMs = retryAfter ? Number(retryAfter) * 1000 : RATE_LIMIT_BACKOFF_MS * (attempt + 1);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    lastResponse = res;
    break;
  }

  return lastResponse!;
}

export class ConfluencePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfluencePermissionError";
  }
}

// ── Provider factory ────────────────────────────────────────────────────

export function createConfluenceDocumentProvider(
  baseUrl: string,
  email: string,
  apiToken: string,
): DocumentProvider {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const headers = makeHeaders(email, apiToken);

  return {
    async getDocument(ref: string): Promise<SpecDocumentDto | null> {
      const resolved = resolveRef(ref);

      let pageId: string;
      if (resolved.kind === "shortLink") {
        const id = await resolveShortLink(resolved.url, headers);
        if (!id) return null;
        pageId = id;
      } else {
        pageId = resolved.value;
      }

      try {
        const url = `${normalizedBase}/rest/api/content/${encodeURIComponent(pageId)}?expand=body.storage,version`;
        const res = await fetchWithRetry(url, headers);

        if (!res.ok) return null;

        const data = (await res.json()) as ConfluenceContentResponse;
        const storageHtml = data.body?.storage?.value ?? "";
        const sections = storageToSections(storageHtml);
        const acceptance_criteria = extractAcceptanceCriteria(sections, pageId);

        return {
          ref: pageId,
          title: data.title,
          sections,
          acceptance_criteria: acceptance_criteria.length > 0 ? acceptance_criteria : undefined,
          updated_at: data.version?.when,
        };
      } catch (err) {
        if (err instanceof ConfluencePermissionError) throw err;
        return null;
      }
    },
  };
}

// ── Connection test ─────────────────────────────────────────────────────

/**
 * Verify Confluence credentials by fetching the current user info.
 * Returns the display name on success, or throws on failure.
 */
export async function testConfluenceConnection(
  baseUrl: string,
  email: string,
  apiToken: string,
): Promise<{ name: string }> {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const headers = makeHeaders(email, apiToken);

  const res = await fetch(
    `${normalizedBase}/rest/api/user/current`,
    { headers },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Invalid credentials — check your Confluence email and API token"
        : `Confluence responded with ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as { displayName?: string; username?: string };
  return { name: data.displayName ?? data.username ?? "Unknown" };
}
