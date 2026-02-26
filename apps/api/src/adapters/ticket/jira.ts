/**
 * RFC-009: Jira Cloud ticket provider (REST API v3)
 * Requires JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN env.
 */
import type { TicketProvider } from "./contract.js";
import type { AcceptanceCriterionDto, TicketDto } from "./types.js";

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

function parseDescriptionForAC(description: string | null): AcceptanceCriterionDto[] {
  if (!description?.trim()) return [];
  const acs: AcceptanceCriterionDto[] = [];
  const lines = description.split(/\n/);
  let index = 0;
  for (const line of lines) {
    const match = line.match(/^(?:[-*]?\s*)(?:AC:?\s*)(.+)$/i) || line.match(/^(\d+\.)\s*(.+)$/);
    if (match) {
      const desc = (match[2] ?? match[1]).trim();
      if (desc) acs.push({ id: `ac/${++index}`, description: desc });
    }
  }
  if (acs.length === 0 && description.trim()) {
    acs.push({ id: "ac/1", description: description.trim().slice(0, 500) });
  }
  return acs;
}

export function createJiraTicketProvider(config: JiraConfig): TicketProvider {
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");

  return {
    async getTicket(id: string): Promise<TicketDto | null> {
      try {
        const res = await fetch(`${baseUrl}/rest/api/3/issue/${encodeURIComponent(id)}`, {
          headers: {
            Accept: "application/json",
            Authorization: `Basic ${auth}`,
          },
        });
        if (!res.ok) return null;
        const issue = (await res.json()) as {
          id: string;
          key: string;
          fields?: {
            summary?: string;
            description?: { type?: string; content?: unknown[]; plain?: string };
            status?: { name?: string };
            updated?: string;
          };
        };
        const fields = issue.fields ?? {};
        let description = "";
        const descRaw = fields.description;
        if (typeof descRaw === "string") {
          description = descRaw;
        } else if (descRaw && typeof descRaw === "object") {
          const d = descRaw as { plain?: string; content?: Array<{ type?: string; text?: string; content?: unknown[] }> };
          if (d.plain) description = d.plain;
          else if (Array.isArray(d.content)) {
            const texts: string[] = [];
            function walk(nodes: typeof d.content): void {
              for (const node of nodes ?? []) {
                if (node && typeof node === "object" && "text" in node && typeof (node as { text?: string }).text === "string")
                  texts.push((node as { text: string }).text);
                if (Array.isArray((node as { content?: unknown[] })?.content))
                  walk((node as { content: typeof d.content }).content);
              }
            }
            walk(d.content);
            description = texts.join(" ");
          }
        }
        const acs = parseDescriptionForAC(description);
        const dto: TicketDto = {
          id: issue.id,
          key: issue.key,
          title: fields.summary ?? "",
          description,
          status: fields.status?.name ?? "Unknown",
          acceptance_criteria: acs.length ? acs : undefined,
          links: [],
          updated_at: fields.updated ?? undefined,
        };
        return dto;
      } catch {
        return null;
      }
    },
  };
}
