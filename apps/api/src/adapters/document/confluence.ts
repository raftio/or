/**
 * RFC-010: Confluence Cloud document provider (REST API)
 * Requires CONFLUENCE_BASE_URL, CONFLUENCE_EMAIL, CONFLUENCE_API_TOKEN env.
 */
import type { DocumentProvider } from "./contract.js";
import type { SpecDocumentDto, SpecSectionDto, SpecAcceptanceCriterionDto } from "./types.js";

export interface ConfluenceConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

function stripStorageHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractSectionsFromStorage(storageValue: string): SpecSectionDto[] {
  const sections: SpecSectionDto[] = [];
  const headingRe = /<h[1-6][^>]*>([^<]*)<\/h[1-6]>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let id = 0;
  while ((match = headingRe.exec(storageValue)) !== null) {
    const title = stripStorageHtml(match[1]);
    const bodyStart = match.index + match[0].length;
    const bodyEnd = storageValue.length;
    const body = stripStorageHtml(storageValue.slice(bodyStart, bodyEnd)).slice(0, 10000);
    if (title) {
      sections.push({
        id: `s${++id}`,
        title,
        body: body.slice(0, 2000),
      });
    }
    lastIndex = match.index;
  }
  if (sections.length === 0) {
    const body = stripStorageHtml(storageValue).slice(0, 10000);
    if (body) sections.push({ id: "s1", title: "Content", body: body.slice(0, 2000) });
  }
  return sections;
}

function extractACFromContent(plain: string): SpecAcceptanceCriterionDto[] {
  const acs: SpecAcceptanceCriterionDto[] = [];
  const lines = plain.split(/\n/);
  let index = 0;
  for (const line of lines) {
    const match = line.match(/^(?:[-*]?\s*)(?:AC:?\s*)(.+)$/i) || line.match(/^(\d+\.)\s*(.+)$/);
    if (match) {
      const desc = (match[2] ?? match[1]).trim();
      if (desc) acs.push({ id: `spec-ac/${++index}`, description: desc });
    }
  }
  return acs;
}

export function createConfluenceDocumentProvider(config: ConfluenceConfig): DocumentProvider {
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");

  return {
    async getDocument(ref: string): Promise<SpecDocumentDto | null> {
      try {
        const pageId = ref.includes(":") ? ref.split(":")[1]!.trim() : ref.trim();
        const url = `${baseUrl}/wiki/api/v2/pages/${encodeURIComponent(pageId)}?body-format=storage`;
        const res = await fetch(url, {
          headers: {
            Accept: "application/json",
            Authorization: `Basic ${auth}`,
          },
        });
        if (!res.ok) return null;
        const page = (await res.json()) as {
          id: string;
          title?: string;
          body?: { storage?: { value?: string } };
          version?: { updatedAt?: string };
        };
        const storageValue = page.body?.storage?.value ?? "";
        const sections = extractSectionsFromStorage(storageValue);
        const plain = stripStorageHtml(storageValue);
        const acceptance_criteria = extractACFromContent(plain);
        return {
          ref: page.id,
          title: page.title ?? "",
          sections,
          acceptance_criteria: acceptance_criteria.length ? acceptance_criteria : undefined,
          updated_at: page.version?.updatedAt,
        };
      } catch {
        return null;
      }
    },
  };
}
