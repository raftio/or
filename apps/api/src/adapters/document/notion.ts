/**
 * RFC-010: Notion document provider (REST API)
 * Requires NOTION_API_KEY env. Ref = page id (UUID without dashes or with).
 */
import type { DocumentProvider } from "./contract.js";
import type {
  SpecDocumentDto,
  SpecSectionDto,
  SpecAcceptanceCriterionDto,
} from "./types.js";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export interface NotionConfig {
  apiKey: string;
}

interface NotionBlock {
  id: string;
  type: string;
  [key: string]: unknown;
}

function extractPlainText(block: NotionBlock): string {
  const type = block.type;
  const content = block[type] as { rich_text?: Array<{ plain_text?: string }> } | undefined;
  const rich = content?.rich_text;
  if (!Array.isArray(rich)) return "";
  return rich.map((t) => t.plain_text ?? "").join("");
}

function extractACFromText(plain: string): SpecAcceptanceCriterionDto[] {
  const acs: SpecAcceptanceCriterionDto[] = [];
  const lines = plain.split(/\n/);
  let index = 0;
  for (const line of lines) {
    const match =
      line.match(/^(?:[-*]?\s*)(?:AC:?\s*)(.+)$/i) ||
      line.match(/^(\d+\.)\s*(.+)$/);
    if (match) {
      const desc = (match[2] ?? match[1]).trim();
      if (desc) acs.push({ id: `spec-ac/${++index}`, description: desc });
    }
  }
  return acs;
}

export function createNotionDocumentProvider(
  config: NotionConfig
): DocumentProvider {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };

  return {
    async getDocument(ref: string): Promise<SpecDocumentDto | null> {
      const pageId = ref.replace(/-/g, "");
      try {
        const pageRes = await fetch(`${NOTION_API}/pages/${pageId}`, {
          headers,
        });
        if (!pageRes.ok) return null;
        const page = (await pageRes.json()) as {
          id: string;
          properties?: Record<
            string,
            { title?: Array<{ plain_text?: string }> }
          >;
          last_edited_time?: string;
        };
        const title =
          Object.values(page.properties ?? {}).find((p) => p.title)?.title
            ?.map((t) => t.plain_text ?? "")
            .join("") ?? "";

        const blocksRes = await fetch(
          `${NOTION_API}/blocks/${pageId}/children?page_size=100`,
          { headers }
        );
        if (!blocksRes.ok) return null;
        const blocksData = (await blocksRes.json()) as {
          results?: NotionBlock[];
        };
        const blocks = blocksData.results ?? [];
        const sections: SpecSectionDto[] = [];
        let currentTitle = "";
        let currentBody: string[] = [];
        const allText: string[] = [];

        for (const block of blocks) {
          const text = extractPlainText(block);
          if (text) allText.push(text);
          const type = block.type;
          if (
            type === "heading_1" ||
            type === "heading_2" ||
            type === "heading_3"
          ) {
            if (currentTitle || currentBody.length) {
              sections.push({
                id: `s${sections.length + 1}`,
                title: currentTitle || "Content",
                body: currentBody.join("\n").slice(0, 2000),
              });
            }
            currentTitle = text;
            currentBody = [];
          } else {
            currentBody.push(text);
          }
        }
        if (currentTitle || currentBody.length) {
          sections.push({
            id: `s${sections.length + 1}`,
            title: currentTitle || "Content",
            body: currentBody.join("\n").slice(0, 2000),
          });
        }
        if (sections.length === 0 && allText.length) {
          sections.push({
            id: "s1",
            title: "Content",
            body: allText.join(" ").slice(0, 2000),
          });
        }
        const acceptance_criteria = extractACFromText(allText.join("\n"));
        return {
          ref: page.id,
          title,
          sections,
          acceptance_criteria:
            acceptance_criteria.length ? acceptance_criteria : undefined,
          updated_at: page.last_edited_time,
        };
      } catch {
        return null;
      }
    },
  };
}
