/**
 * RFC-010: Notion document provider – fetches pages via Notion API.
 * Auth: Internal Integration Token (Bearer).
 */
import type { DocumentProvider } from "./contract.js";
import type { SpecDocumentDto, SpecSectionDto } from "./types.js";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface NotionRichText {
  plain_text: string;
}

interface NotionBlock {
  id: string;
  type: string;
  [key: string]: unknown;
}

interface NotionBlocksResponse {
  results: NotionBlock[];
  has_more: boolean;
  next_cursor: string | null;
}

interface NotionPageResponse {
  id: string;
  properties: Record<string, unknown>;
  last_edited_time?: string;
}

function richTextToPlain(richTexts: unknown): string {
  if (!Array.isArray(richTexts)) return "";
  return (richTexts as NotionRichText[])
    .map((rt) => rt.plain_text ?? "")
    .join("");
}

function extractBlockText(block: NotionBlock): string {
  const data = block[block.type] as Record<string, unknown> | undefined;
  if (!data) return "";
  return richTextToPlain(data.rich_text);
}

function isHeading(type: string): boolean {
  return type === "heading_1" || type === "heading_2" || type === "heading_3";
}

/**
 * Extract the page title from Notion page properties.
 * The title property can appear under any key but has type "title".
 */
function extractPageTitle(properties: Record<string, unknown>): string {
  for (const value of Object.values(properties)) {
    const prop = value as Record<string, unknown>;
    if (prop.type === "title") {
      return richTextToPlain(prop.title);
    }
  }
  return "Untitled";
}

/**
 * Group Notion blocks into sections split by headings.
 * Content before the first heading goes into a "Content" section.
 */
function blocksToSections(blocks: NotionBlock[]): SpecSectionDto[] {
  const sections: SpecSectionDto[] = [];
  let currentTitle = "Content";
  let currentBody: string[] = [];
  let sectionIndex = 0;

  for (const block of blocks) {
    if (isHeading(block.type)) {
      if (currentBody.length > 0 || sectionIndex > 0) {
        sections.push({
          id: `s${++sectionIndex}`,
          title: currentTitle,
          body: currentBody.join("\n"),
        });
      }
      currentTitle = extractBlockText(block) || "Untitled Section";
      currentBody = [];
    } else {
      const text = extractBlockText(block);
      if (text) currentBody.push(text);
    }
  }

  if (currentBody.length > 0 || sections.length === 0) {
    sections.push({
      id: `s${++sectionIndex}`,
      title: currentTitle,
      body: currentBody.join("\n"),
    });
  }

  return sections;
}

function makeHeaders(apiToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiToken}`,
    "Notion-Version": NOTION_VERSION,
    Accept: "application/json",
  };
}

async function fetchAllBlocks(
  pageId: string,
  headers: Record<string, string>,
): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(`${NOTION_API}/blocks/${pageId}/children`);
    url.searchParams.set("page_size", "100");
    if (cursor) url.searchParams.set("start_cursor", cursor);

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) return blocks;

    const data = (await res.json()) as NotionBlocksResponse;
    blocks.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return blocks;
}

export function createNotionDocumentProvider(
  apiToken: string,
): DocumentProvider {
  const headers = makeHeaders(apiToken);

  return {
    async getDocument(ref: string): Promise<SpecDocumentDto | null> {
      try {
        const pageRes = await fetch(`${NOTION_API}/pages/${encodeURIComponent(ref)}`, {
          headers,
        });
        if (!pageRes.ok) return null;

        const page = (await pageRes.json()) as NotionPageResponse;
        const title = extractPageTitle(page.properties);

        const blocks = await fetchAllBlocks(ref, headers);
        const sections = blocksToSections(blocks);

        return {
          ref,
          title,
          sections,
          updated_at: page.last_edited_time,
        };
      } catch {
        return null;
      }
    },
  };
}

/**
 * Verify Notion credentials by fetching the bot user info.
 * Returns the bot name on success, or throws on failure.
 */
export async function testNotionConnection(
  apiToken: string,
): Promise<{ name: string }> {
  const res = await fetch(`${NOTION_API}/users/me`, {
    headers: makeHeaders(apiToken),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Invalid token — check your Notion integration token"
        : `Notion responded with ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as { name: string };
  return { name: data.name };
}
